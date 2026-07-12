use serde::{Deserialize, Serialize};
use sha1::{Sha1, Digest};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

use crate::sanitize::sanitize_name;

// ─── Types ──────────────────────────────────────────────────────────

/// Input for creating an instance from a modpack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFromModpackInput {
    pub name: String,
    pub modpack_url: String,
    pub modpack_name: String,
    pub modpack_version_id: String,
    pub ram: u64,
    pub java_version: String,
    pub custom_java_path: Option<String>,
    pub jvm_args: Option<String>,
    /// Instance icon identifier (e.g. "url:https://...")
    pub icon: Option<String>,
}

/// Structure of modrinth.index.json inside a .mrpack
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModrinthIndex {
    format_version: u64,
    game: String,
    #[allow(dead_code)]
    version_id: String,
    #[allow(dead_code)]
    name: String,
    #[allow(dead_code)]
    #[serde(default)]
    summary: Option<String>,
    dependencies: std::collections::HashMap<String, String>,
    files: Vec<ModrinthIndexFile>,
}

/// A single file entry in the modpack index
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModrinthIndexFile {
    path: String,
    #[allow(dead_code)]
    hashes: ModrinthIndexHashes,
    #[serde(default)]
    env: Option<ModrinthIndexEnv>,
    downloads: Vec<String>,
    #[allow(dead_code)]
    #[serde(default)]
    file_size: u64,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ModrinthIndexHashes {
    #[allow(dead_code)]
    #[serde(default)]
    sha1: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    sha512: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModrinthIndexEnv {
    #[serde(default)]
    client: Option<String>,  // "required", "optional", "unsupported"
    #[allow(dead_code)]
    #[serde(default)]
    server: Option<String>,
}

/// Result of creating an instance from a modpack
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFromModpackResult {
    pub success: bool,
    pub instance_name: String,
    pub stats: ModpackInstallStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackInstallStats {
    pub total_files: usize,
    pub downloaded: usize,
    pub skipped: usize,
    pub errors: usize,
    pub overrides_copied: bool,
}

/// Progress event emitted during modpack installation
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackProgressEvent {
    pub phase: String,      // "downloading_modpack" | "parsing" | "downloading_files" | "copying_overrides" | "done"
    pub current: usize,
    pub total: usize,
    pub message: String,
}

// ─── Helpers ────────────────────────────────────────────────────────

/// Check if a relative path is safe (no parent dir traversal, no absolute paths).
/// Prevents Zip Slip vulnerability.
fn is_safe_relative_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    for component in normalized.split('/') {
        match component {
            ".." => return false,
            "~" => return false,
            "" | "." => continue,
            _ => {
                if component.starts_with('/') {
                    return false;
                }
            }
        }
    }
    true
}

fn get_instance_dir(app_data_dir: &Path, instance_name: &str) -> PathBuf {
    app_data_dir.join("instances").join(sanitize_name(instance_name))
}

fn emit_progress(app_handle: &AppHandle, event: ModpackProgressEvent) {
    let _ = app_handle.emit("modpack:progress", event);
}

/// Create a temporary directory for downloading and extracting the modpack
fn create_temp_dir() -> Result<PathBuf, String> {
    let mut temp = std::env::temp_dir();
    temp.push(format!("anonlauncher_modpack_{}", std::process::id()));
    fs::create_dir_all(&temp).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    Ok(temp)
}

/// Copy a directory recursively
fn copy_dir_recursively(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursively(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// ─── URL Parsing ────────────────────────────────────────────────────

/// Parse a Modrinth CDN URL to extract project_id and version_id.
/// Format: https://cdn.modrinth.com/data/{projectId}/versions/{versionId}/{fileName}
fn parse_modrinth_url(url: &str) -> Option<(String, String)> {
    let path = url.strip_prefix("https://cdn.modrinth.com/data/")?;
    let parts: Vec<&str> = path.splitn(2, '/').collect();
    let project_id = parts.first()?.to_string();
    let rest = parts.get(1)?.strip_prefix("versions/")?;
    let parts2: Vec<&str> = rest.splitn(2, '/').collect();
    let version_id = parts2.first()?.to_string();
    Some((project_id, version_id))
}

// ─── Modrinth API Helpers ───────────────────────────────────────────

/// Fetch project metadata from Modrinth API. Returns (title, slug, icon_url).
fn fetch_project_metadata(project_id: &str) -> Option<(String, String, String)> {
    let url = format!("https://api.modrinth.com/v2/project/{}", project_id);
    let resp = reqwest::blocking::get(&url).ok()?;
    if !resp.status().is_success() { return None; }
    let body: serde_json::Value = resp.json().ok()?;
    let title = body.get("title")?.as_str()?.to_string();
    let slug = body.get("slug")?.as_str()?.to_string();
    let icon_url = body.get("icon_url")?.as_str().map(|s| s.to_string());
    Some((title, slug, icon_url.unwrap_or_default()))
}

/// Fetch the version_number for a specific version_id from Modrinth API.
fn fetch_version_number(project_id: &str, version_id: &str) -> Option<String> {
    let url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);
    let resp = reqwest::blocking::get(&url).ok()?;
    if !resp.status().is_success() { return None; }
    let versions: Vec<serde_json::Value> = resp.json().ok()?;
    for v in &versions {
        if v.get("id")?.as_str()? == version_id {
            return v.get("version_number")?.as_str().map(|s| s.to_string());
        }
    }
    None
}

// ─── Background Thread API ──────────────────────────────────────────

/// Event emitted when modpack installation completes successfully
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackDoneEvent {
    pub instance_name: String,
}

/// Event emitted when modpack installation fails
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackErrorEvent {
    pub message: String,
}

/// Launch modpack installation in a background thread.
/// Returns immediately; progress/completion/error sent via events.
pub fn create_from_modpack_background(
    app_handle: AppHandle,
    app_data_dir: PathBuf,
    input: CreateFromModpackInput,
    cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
) {
    std::thread::spawn(move || {
        let result = create_from_modpack_inner(
            &app_handle,
            &app_data_dir,
            &input,
            &cancel_flag,
        );

        match result {
            Ok(res) => {
                let _ = app_handle.emit("modpack:done", ModpackDoneEvent {
                    instance_name: res.instance_name,
                });
            }
            Err(e) => {
                // If cancelled, emit cancelled event with short message
                let msg = if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    "Cancelled".to_string()
                } else {
                    e
                };
                let _ = app_handle.emit("modpack:error", ModpackErrorEvent {
                    message: msg,
                });
            }
        }
    });
}

// ─── Public API ─────────────────────────────────────────────────────

/// Internal implementation — accepts a cancellation flag.
fn create_from_modpack_inner(
    app_handle: &AppHandle,
    app_data_dir: &Path,
    input: &CreateFromModpackInput,
    cancel_flag: &std::sync::atomic::AtomicBool,
) -> Result<CreateFromModpackResult, String> {
    // Check cancellation before starting
    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("Cancelled".to_string());
    }

    let temp_dir = create_temp_dir()?;
    let mrpack_path = temp_dir.join("modpack.mrpack");

    // ── Phase 1: Download .mrpack ──────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "downloading_modpack".to_string(),
        current: 0,
        total: 1,
        message: "Downloading modpack...".to_string(),
    });

    let response = reqwest::blocking::get(&input.modpack_url)
        .map_err(|e| format!("Failed to download modpack: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to download modpack: HTTP {}", response.status()));
    }

    let bytes = response.bytes()
        .map_err(|e| format!("Failed to read modpack data: {}", e))?;

    fs::write(&mrpack_path, &bytes)
        .map_err(|e| format!("Failed to save modpack file: {}", e))?;

    // ── Phase 2: Parse modrinth.index.json ─────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "parsing".to_string(),
        current: 0,
        total: 1,
        message: "Parsing modpack...".to_string(),
    });

    let mrpack_file = fs::File::open(&mrpack_path)
        .map_err(|e| format!("Failed to open modpack file: {}", e))?;

    let mut archive = zip::ZipArchive::new(mrpack_file)
        .map_err(|e| format!("Failed to read modpack ZIP: {}", e))?;

    // Extract and parse modrinth.index.json
    let index_json = {
        let mut found = false;
        let mut content = String::new();

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)
                .map_err(|e| format!("Failed to read ZIP entry {}: {}", i, e))?;

            let name = entry.name().to_string();

            if name == "modrinth.index.json" {
                entry.read_to_string(&mut content)
                    .map_err(|e| format!("Failed to read modrinth.index.json: {}", e))?;
                found = true;
                break;
            }
        }

        if !found {
            // Need to reopen the archive since we borrowed it
            return Err("modrinth.index.json not found in modpack".to_string());
        }

        content
    };

    // Re-open archive for later use (overrides extraction)
    let mrpack_file2 = fs::File::open(&mrpack_path)
        .map_err(|e| format!("Failed to open modpack file: {}", e))?;

    let mut archive2 = zip::ZipArchive::new(mrpack_file2)
        .map_err(|e| format!("Failed to read modpack ZIP: {}", e))?;

    // Parse the index
    let index: ModrinthIndex = serde_json::from_str(&index_json)
        .map_err(|e| format!("Failed to parse modrinth.index.json: {}", e))?;

    // Validate format version
    if index.format_version != 1 {
        return Err(format!("Unsupported modpack format version: {}", index.format_version));
    }

    if index.game != "minecraft" {
        return Err(format!("Unsupported game: {}", index.game));
    }

    // Get dependencies
    let mc_version = index.dependencies.get("minecraft")
        .ok_or_else(|| "Missing 'minecraft' dependency in modpack".to_string())?;

    // Detect mod loader from dependencies
    let (loader_type, loader_version) = if let Some(ver) = index.dependencies.get("fabric-loader") {
        ("fabric".to_string(), ver.clone())
    } else if let Some(ver) = index.dependencies.get("neoforge") {
        ("neoforge".to_string(), ver.clone())
    } else {
        return Err(
            "Missing 'fabric-loader' or 'neoforge' dependency in modpack (only Fabric and NeoForge modpacks supported)"
                .to_string()
        );
    };

    // ── Phase 3: Create instance ───────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "parsing".to_string(),
        current: 1,
        total: 1,
        message: format!("Creating instance for {}...", mc_version),
    });

    // Build CreateInstanceInput
    let create_input = crate::manifest::CreateInstanceInput {
        name: input.name.clone(),
        mc_version: mc_version.clone(),
        loader: loader_type.clone(),
        loader_version: loader_version.clone(),
        java_version: input.java_version.clone(),
        custom_java_path: input.custom_java_path.clone(),
        ram: input.ram,
        jvm_args: input.jvm_args.clone(),
        icon: input.icon.clone(),
        launch_count: None,
    };

    // Create the instance
    let _manifest = crate::instance_manager::create_instance(&app_data_dir, create_input)
        .map_err(|e| format!("Failed to create instance: {}", e))?;

    let instance_dir = get_instance_dir(&app_data_dir, &input.name);

    // ── Phase 4: Download all files ────────────────────────────────
    let total_files = index.files.len();
    let mut downloaded: usize = 0;
    let mut skipped: usize = 0;
    let mut errors: usize = 0;

    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 0,
        total: total_files,
        message: format!("Downloading {} files...", total_files),
    });

    for file_entry in &index.files {
        // Check environment requirements
        let should_download = match &file_entry.env {
            Some(env) => {
                match env.client.as_deref() {
                    Some("unsupported") => false,
                    _ => true, // "required", "optional", or missing = download
                }
            }
            None => true,
        };

        if !should_download {
            skipped += 1;
            emit_progress(&app_handle, ModpackProgressEvent {
                phase: "downloading_files".to_string(),
                current: downloaded + skipped + errors,
                total: total_files,
                message: format!("Skipping '{}' (not required on client)", file_entry.path),
            });
            continue;
        }

        // Get download URL
        let dl_url = match file_entry.downloads.first() {
            Some(url) => url.clone(),
            None => {
                errors += 1;
                emit_progress(&app_handle, ModpackProgressEvent {
                    phase: "downloading_files".to_string(),
                    current: downloaded + skipped + errors,
                    total: total_files,
                    message: format!("No URL for '{}'", file_entry.path),
                });
                continue;
            }
        };

        // Compute target path
        let target_path = instance_dir.join(&file_entry.path);

        // Create parent directories
        if let Some(parent) = target_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors += 1;
                emit_progress(&app_handle, ModpackProgressEvent {
                    phase: "downloading_files".to_string(),
                    current: downloaded + skipped + errors,
                    total: total_files,
                    message: format!("Failed to create directory: {}", e),
                });
                continue;
            }
        }

        // Download the file
        match reqwest::blocking::get(&dl_url) {
            Ok(resp) => {
                if resp.status().is_success() {
                    match resp.bytes() {
                        Ok(file_bytes) => {
                            // ── SHA1 verification ──────────────────────
                            // Modrinth provides SHA1 hashes for all files.
                            if let Some(ref expected_sha1) = file_entry.hashes.sha1 {
                                if !expected_sha1.is_empty() {
                                    let mut hasher = Sha1::new();
                                    hasher.update(&file_bytes);
                                    let actual_hash = hex::encode(hasher.finalize());
                                    if actual_hash != *expected_sha1 {
                                        errors += 1;
                                        emit_progress(&app_handle, ModpackProgressEvent {
                                            phase: "downloading_files".to_string(),
                                            current: downloaded + skipped + errors,
                                            total: total_files,
                                            message: format!("SHA1 mismatch for '{}'", file_entry.path),
                                        });
                                        continue;
                                    }
                                }
                            }

                            if let Err(e) = fs::write(&target_path, &file_bytes) {
                                errors += 1;
                                emit_progress(&app_handle, ModpackProgressEvent {
                                    phase: "downloading_files".to_string(),
                                    current: downloaded + skipped + errors,
                                    total: total_files,
                                    message: format!("Failed to write '{}': {}", file_entry.path, e),
                                });
                            } else {
                                downloaded += 1;

                                // ── Check cancellation before metadata fetch ──
                                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                                    // Clean up: delete the partially created instance
                                    let _ = fs::remove_dir_all(&instance_dir);
                                    // Clean up: delete temp files
                                    let _ = fs::remove_dir_all(&temp_dir);return Err("Cancelled".to_string());
                }

                                // ── Register mod metadata if file is in mods/ ──
                                if file_entry.path.starts_with("mods/") || file_entry.path.starts_with("mods\\") {
                                    // Extract the file name from the path (e.g. "mods/sodium.jar" → "sodium.jar")
                                    let file_name = file_entry.path
                                        .trim_start_matches("mods/")
                                        .trim_start_matches("mods\\");

                                    // Try to parse project ID and version ID from the CDN URL
                                    let (project_id, version_id) = parse_modrinth_url(&dl_url)
                                        .unwrap_or((String::new(), String::new()));

                                    if !project_id.is_empty() && !version_id.is_empty() {
                                        // ── Fetch project metadata from Modrinth API ──
                                        emit_progress(&app_handle, ModpackProgressEvent {
                                            phase: "downloading_files".to_string(),
                                            current: downloaded + skipped + errors,
                                            total: total_files,
                                            message: format!("Fetching metadata for {}", file_name),
                                        });

                                        let (mod_title, mod_slug, mod_icon_url) = fetch_project_metadata(&project_id)
                                            .unwrap_or((
                                                String::new(),
                                                project_id.clone(),
                                                String::new(),
                                            ));

                                        // Fetch version number
                                        let version_number = fetch_version_number(&project_id, &version_id)
                                            .unwrap_or_default();

                                        // Use title as name if available, otherwise fall back to filename
                                        let mod_name = if mod_title.is_empty() {
                                            file_name
                                                .trim_end_matches(".jar")
                                                .trim_end_matches(".jar.disabled")
                                                .to_string()
                                        } else {
                                            mod_title
                                        };

                                        let project_slug = if mod_slug.is_empty() { None } else { Some(mod_slug) };
                                        let icon_url = if mod_icon_url.is_empty() { None } else { Some(mod_icon_url) };
                                        let ver_id = Some(version_id.clone());
                                        let ver_num = if version_number.is_empty() { None } else { Some(version_number) };

                                        if let Err(e) = crate::mod_installer::register_mod_metadata_full(
                                            &app_data_dir,
                                            &input.name,
                                            file_name,
                                            &mod_name,
                                            ver_id,
                                            ver_num,
                                            project_slug,
                                            icon_url,
                                        ) {
                                            emit_progress(&app_handle, ModpackProgressEvent {
                                                phase: "downloading_files".to_string(),
                                                current: downloaded + skipped + errors,
                                                total: total_files,
                                                message: format!("Failed to save metadata: {}", e),
                                            });
                                        }
                                    } else {
                                        // Non-Modrinth URL — register with basic metadata
                                        let _ = crate::mod_installer::register_mod_metadata(
                                            &app_data_dir,
                                            &input.name,
                                            file_name,
                                            None,
                                            None,
                                            None,
                                        );
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            errors += 1;
                            emit_progress(&app_handle, ModpackProgressEvent {
                                phase: "downloading_files".to_string(),
                                current: downloaded + skipped + errors,
                                total: total_files,
                                message: format!("Failed to read '{}': {}", file_entry.path, e),
                            });
                        }
                    }
                } else {
                    errors += 1;
                    emit_progress(&app_handle, ModpackProgressEvent {
                        phase: "downloading_files".to_string(),
                        current: downloaded + skipped + errors,
                        total: total_files,
                        message: format!("HTTP {} for '{}'", resp.status(), file_entry.path),
                    });
                }
            }
            Err(e) => {
                errors += 1;
                emit_progress(&app_handle, ModpackProgressEvent {
                    phase: "downloading_files".to_string(),
                    current: downloaded + skipped + errors,
                    total: total_files,
                    message: format!("Failed to download '{}': {}", file_entry.path, e),
                });
            }
        }
    }

    // ── Phase 5: Run NeoForge installer (if applicable) ────────────
    if loader_type == "neoforge" {
        emit_progress(&app_handle, ModpackProgressEvent {
            phase: "downloading_files".to_string(),
            current: 0,
            total: 1,
            message: "Setting up NeoForge loader...".to_string(),
        });

        // Resolve Java path
        let java_path: String = if let Some(ref custom) = input.custom_java_path {
            if !custom.is_empty() {
                custom.clone()
            } else {
                resolve_java_path(app_data_dir, &input.java_version)
            }
        } else {
            resolve_java_path(app_data_dir, &input.java_version)
        };

        // Run NeoForge installer (blocking, inside this thread)
        // We emit modpack:progress events so the existing dialog shows the progress
        if let Err(e) = install_neoforge_for_modpack(
            app_handle,
            app_data_dir,
            &mc_version,
            &loader_version,
            &java_path,
        ) {
            return Err(format!("NeoForge installation failed: {}", e));
        }
    }

    // ── Phase 6: Copy overrides/ ───────────────────────────────────
    let mut overrides_copied = false;

    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "copying_overrides".to_string(),
        current: 0,
        total: 1,
        message: "Copying configuration...".to_string(),
    });

    // Extract overrides/ from the .mrpack to a temp folder, then copy to instance
    let overrides_temp = temp_dir.join("overrides_extracted");
    let mut has_overrides = false;

    for i in 0..archive2.len() {
        let mut entry = match archive2.by_index(i) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_name = entry.name().to_string();

        // Check if entry starts with "overrides/"
        if !entry_name.starts_with("overrides/") && !entry_name.starts_with("overrides\\") {
            continue;
        }

        has_overrides = true;

        // Strip "overrides/" prefix
        let relative_path = entry_name.trim_start_matches("overrides/").trim_start_matches("overrides\\");
        if relative_path.is_empty() {
            continue; // Skip the directory entry itself
        }

        // ── Zip Slip protection ────────────────────────────────────
        if !is_safe_relative_path(relative_path) {
            emit_progress(&app_handle, ModpackProgressEvent {
                phase: "copying_overrides".to_string(),
                current: 0,
                total: 1,
                message: format!("Skipped unsafe path: '{}'", relative_path),
            });
            continue;
        }

        let target_path = overrides_temp.join(relative_path);

        if entry.is_dir() {
            let _ = fs::create_dir_all(&target_path);
        } else {
            if let Some(parent) = target_path.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let mut data = Vec::new();
            if entry.read_to_end(&mut data).is_ok() {
                let _ = fs::write(&target_path, &data);
            }
        }
    }

    if has_overrides {
        // Copy overrides to instance directory
        if overrides_temp.exists() {
            if let Err(e) = copy_dir_recursively(&overrides_temp, &instance_dir) {
                emit_progress(&app_handle, ModpackProgressEvent {
                    phase: "copying_overrides".to_string(),
                    current: 1,
                    total: 1,
                    message: format!("Failed to copy configuration: {}", e),
                });
            } else {
                overrides_copied = true;
            }
        }
    }

    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "copying_overrides".to_string(),
        current: 1,
        total: 1,
        message: if overrides_copied {
            "Configuration copied".to_string()
        } else {
            "No additional configuration".to_string()
        },
    });

    // ── Phase 7: Cleanup ───────────────────────────────────────────
    let _ = fs::remove_dir_all(&temp_dir);

    // ── Done ───────────────────────────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "done".to_string(),
        current: total_files,
        total: total_files,
        message: format!(
            "Done! Downloaded {}, skipped {}, errors: {}",
            downloaded, skipped, errors
        ),
    });

    Ok(CreateFromModpackResult {
        success: true,
        instance_name: input.name.clone(),
        stats: ModpackInstallStats {
            total_files,
            downloaded,
            skipped,
            errors,
            overrides_copied,
        },
    })
}

// ─── NeoForge Installer for Modpack ─────────────────────────────────

/// Resolve a Java path for the given version.
/// Tries the bundled Java runtime first, falls back to "java" on PATH.
fn resolve_java_path(app_data_dir: &Path, java_version: &str) -> String {
    let manager = crate::java_manager::JavaManager::new(&app_data_dir.to_path_buf());
    manager.get_java_path(java_version).unwrap_or_else(|_| "java".to_string())
}

/// Run the NeoForge installer, emitting modpack progress events.
/// This is called inside create_from_modpack_inner when loader is "neoforge".
fn install_neoforge_for_modpack(
    app_handle: &AppHandle,
    app_data_dir: &Path,
    _mc_version: &str,
    neoforge_version: &str,
    java_path: &str,
) -> Result<(), String> {
    // ── Step 1: Download installer JAR ──────────────────────────────
    let installer_url = format!(
        "https://maven.neoforged.net/releases/net/neoforged/neoforge/{ver}/neoforge-{ver}-installer.jar",
        ver = neoforge_version
    );

    emit_progress(app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 0,
        total: 1,
        message: format!("Downloading NeoForge {} installer...", neoforge_version),
    });

    let temp_dir = app_data_dir.join("tmp").join("neoforge");
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let installer_path = temp_dir.join(format!("neoforge-{}-installer.jar", neoforge_version));

    if !installer_path.exists() {
        let resp = reqwest::blocking::get(&installer_url)
            .map_err(|e| format!("Failed to download NeoForge installer: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Failed to download NeoForge installer: HTTP {} from {}",
                resp.status(),
                installer_url
            ));
        }

        let bytes = resp.bytes()
            .map_err(|e| format!("Failed to read installer bytes: {}", e))?;

        fs::write(&installer_path, &bytes)
            .map_err(|e| format!("Failed to write installer to disk: {}", e))?;

        let file_size = fs::metadata(&installer_path)
            .map(|m| m.len())
            .unwrap_or(0);
        if file_size == 0 {
            return Err("Downloaded installer is empty (0 bytes)".to_string());
        }
    }

    // ── Step 2: Verify Java is executable ──────────────────────────
    emit_progress(app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 0,
        total: 1,
        message: "Verifying Java runtime...".to_string(),
    });

    let java_check = std::process::Command::new(java_path)
        .arg("-version")
        .output()
        .map_err(|e| format!("Java not found at '{}': {}", java_path, e))?;

    if !java_check.status.success() {
        let java_stderr = String::from_utf8_lossy(&java_check.stderr);
        return Err(format!("Java check failed at '{}': {}", java_path, java_stderr.trim()));
    }

    // ── Step 3: Ensure launcher_profiles.json exists ───────────────
    emit_progress(app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 0,
        total: 1,
        message: "Setting up launcher profiles...".to_string(),
    });

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
    emit_progress(app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 0,
        total: 1,
        message: "Running NeoForge installer (this may take a minute)...".to_string(),
    });

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
        let detail = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else if !stdout.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            "No output — exit code may indicate a Java or JAR error".to_string()
        };
        return Err(format!("NeoForge installer failed: {}", detail));
    }

    // ── Step 5: Verify version JSON was created ────────────────────
    let version_id = format!("neoforge-{}", neoforge_version);
    let version_json_path = app_data_dir
        .join("versions")
        .join(&version_id)
        .join(format!("{}.json", version_id));

    if !version_json_path.exists() {
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

    // Clean up temp
    let _ = fs::remove_dir_all(&temp_dir);

    emit_progress(app_handle, ModpackProgressEvent {
        phase: "downloading_files".to_string(),
        current: 1,
        total: 1,
        message: "NeoForge installed successfully!".to_string(),
    });

    Ok(())
}
