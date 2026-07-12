use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

// ─── Events ──────────────────────────────────────────────────────────

/// Progress event emitted during NeoForge installation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NeoForgeProgressEvent {
    pub step: String,   // "preparing" | "download" | "verify_java" | "profile" | "install" | "verify_install" | "done"
    pub message: String,
}

/// Event emitted when NeoForge installation completes successfully
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NeoForgeDoneEvent {
    pub version_id: String,
}

/// Event emitted when NeoForge installation fails
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NeoForgeErrorEvent {
    pub message: String,
}

fn emit_progress(app_handle: &AppHandle, step: &str, message: String) {
    let _ = app_handle.emit("neoforge:progress", NeoForgeProgressEvent {
        step: step.to_string(),
        message,
    });
}

// ─── Background Thread API ──────────────────────────────────────────

/// Launch NeoForge installation in a background thread.
/// Returns immediately; progress/completion/error sent via events.
pub fn install_neoforge_background(
    app_handle: AppHandle,
    app_data_dir: PathBuf,
    mc_version: String,
    neoforge_version: String,
    java_path: String,
) {
    std::thread::spawn(move || {
        let result = install_neoforge_inner(
            &app_handle,
            &app_data_dir,
            &mc_version,
            &neoforge_version,
            &java_path,
        );

        match result {
            Ok(version_id) => {
                let _ = app_handle.emit("neoforge:done", NeoForgeDoneEvent {
                    version_id,
                });
            }
            Err(e) => {
                let _ = app_handle.emit("neoforge:error", NeoForgeErrorEvent {
                    message: e,
                });
            }
        }
    });
}

// ─── Internal Implementation ─────────────────────────────────────────

fn install_neoforge_inner(
    app_handle: &AppHandle,
    app_data_dir: &Path,
    _mc_version: &str,
    neoforge_version: &str,
    java_path: &str,
) -> Result<String, String> {
    let installer_url = format!(
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/{ver}/neoforge-{ver}-installer.jar",
        ver = neoforge_version
    );

    emit_progress(app_handle, "preparing", "Preparing installation...".to_string());

    // Temporary directory for the installer
    let temp_dir = app_data_dir.join("tmp").join("neoforge");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let installer_path = temp_dir.join(format!("neoforge-{}-installer.jar", neoforge_version));

    // ── Step 1: Download installer JAR ──────────────────────────────
    if !installer_path.exists() {
        emit_progress(app_handle, "download", format!("Downloading NeoForge {} installer...", neoforge_version));

        let resp = reqwest::blocking::get(&installer_url)
            .map_err(|e| format!("Failed to download NeoForge installer: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Failed to download NeoForge installer: HTTP {} from {}",
                resp.status(),
                installer_url
            ));
        }

        let total_size = resp.content_length().unwrap_or(0);
        let bytes = resp.bytes()
            .map_err(|e| format!("Failed to read installer bytes: {}", e))?;

        let size_mb = if total_size > 0 {
            format!(" ({:.1} MB)", total_size as f64 / 1_048_576.0)
        } else {
            String::new()
        };

        fs::write(&installer_path, &bytes)
            .map_err(|e| format!("Failed to write installer to disk: {}", e))?;

        // Verify file was written
        let file_size = fs::metadata(&installer_path)
            .map(|m| m.len())
            .unwrap_or(0);
        if file_size == 0 {
            return Err("Downloaded installer is empty (0 bytes)".to_string());
        }

        emit_progress(app_handle, "download", format!("Downloaded NeoForge installer{size_mb}"));
    } else {
        emit_progress(app_handle, "download", "Using cached NeoForge installer...".to_string());
    }

    // ── Step 2: Verify Java is executable ──────────────────────────
    emit_progress(app_handle, "verify_java", "Verifying Java runtime...".to_string());
    let java_check = std::process::Command::new(java_path)
        .arg("-version")
        .output()
        .map_err(|e| format!("Java not found at '{}': {}", java_path, e))?;

    if !java_check.status.success() {
        let java_stderr = String::from_utf8_lossy(&java_check.stderr);
        return Err(format!(
            "Java check failed at '{}': {}",
            java_path,
            java_stderr.trim()
        ));
    }

    // ── Step 3: Ensure launcher_profiles.json exists ───────────────
    emit_progress(app_handle, "profile", "Setting up launcher profiles...".to_string());
    let launcher_profiles_path = app_data_dir.join("launcher_profiles.json");
    if !launcher_profiles_path.exists() {
        let minimal_profiles = serde_json::json!({
            "profiles": {},
            "selectedProfile": "(Default)",
            "selectedUser": {},
            "clientToken": "00000000-0000-0000-0000-000000000000",
            "launcherVersion": {
                "name": "21",
                "format": 21
            }
        });
        let profiles_json = serde_json::to_string_pretty(&minimal_profiles)
            .map_err(|e| format!("Failed to serialize launcher_profiles.json: {}", e))?;
        fs::write(&launcher_profiles_path, &profiles_json)
            .map_err(|e| format!("Failed to create launcher_profiles.json: {}", e))?;
    }

    // ── Step 4: Run installer ──────────────────────────────────────
    emit_progress(app_handle, "install", "Running NeoForge installer (this may take a minute)...".to_string());

    let game_dir_str = app_data_dir.to_str().unwrap_or(".");
    let output = std::process::Command::new(java_path)
        .arg("-jar")
        .arg(&installer_path)
        .arg("--install-client")
        .arg(game_dir_str)
        .output()
        .map_err(|e| format!("Failed to run NeoForge installer: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr_trimmed = stderr.trim();
        let stdout_trimmed = stdout.trim();
        let detail = if !stderr_trimmed.is_empty() {
            stderr_trimmed
        } else if !stdout_trimmed.is_empty() {
            stdout_trimmed
        } else {
            "No output — exit code may indicate a Java or JAR error"
        };
        return Err(format!("NeoForge installer failed: {}", detail));
    }

    // ── Step 5: Find generated version JSON ───────────────────────
    emit_progress(app_handle, "verify_install", "Verifying installation...".to_string());

    // NeoForge installer creates: versions/neoforge-<ver>/neoforge-<ver>.json
    let version_id = format!("neoforge-{}", neoforge_version);
    let version_json_path = app_data_dir
        .join("versions")
        .join(&version_id)
        .join(format!("{}.json", version_id));

    if !version_json_path.exists() {
        // List what IS in the versions directory for debugging
        let versions_dir = app_data_dir.join("versions");
        let mut found_entries = String::new();
        if versions_dir.exists() {
            if let Ok(entries) = fs::read_dir(&versions_dir) {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if !found_entries.is_empty() {
                            found_entries.push_str(", ");
                        }
                        found_entries.push_str(&name);
                    }
                }
            }
        }
        let hint = if found_entries.is_empty() {
            "versions directory is empty or missing".to_string()
        } else {
            format!("found entries in versions/: [{}]", found_entries)
        };

        return Err(format!(
            "NeoForge installer completed but version JSON not found at '{}'. {}",
            version_json_path.display(),
            hint
        ));
    }

    emit_progress(app_handle, "done", "NeoForge installed successfully!".to_string());

    // Clean up temp
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(version_id)
}

/// Read the NeoForge-generated version JSON file and return its raw content.
pub fn read_neoforge_version_json(
    app_data_dir: &Path,
    version_id: &str,
) -> Result<String, String> {
    let version_json_path = app_data_dir
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));

    if !version_json_path.exists() {
        return Err(format!(
            "NeoForge version JSON not found at: {}",
            version_json_path.display()
        ));
    }

    fs::read_to_string(&version_json_path)
        .map_err(|e| format!("Failed to read NeoForge version JSON: {}", e))
}
