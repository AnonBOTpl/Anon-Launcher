use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

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

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '_' => c,
            ' ' | '.' => '_',
            _ => '_',
        })
        .collect::<String>()
        .trim_matches('_')
        .to_lowercase()
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

// ─── Public API ─────────────────────────────────────────────────────

/// Create a new instance from a Modrinth modpack (.mrpack).
///
/// Process:
/// 1. Download .mrpack to temp directory
/// 2. Extract modrinth.index.json
/// 3. Create instance with correct MC version + loader from dependencies
/// 4. Download all files from files[] array
/// 5. Copy overrides/ to instance
/// 6. Clean up temp files
pub fn create_from_modpack(
    app_handle: AppHandle,
    app_data_dir: PathBuf,
    input: CreateFromModpackInput,
) -> Result<CreateFromModpackResult, String> {
    let temp_dir = create_temp_dir()?;
    let mrpack_path = temp_dir.join("modpack.mrpack");

    // ── Phase 1: Download .mrpack ──────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "downloading_modpack".to_string(),
        current: 0,
        total: 1,
        message: "Pobieranie paczki modów...".to_string(),
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
        message: "Parsowanie paczki modów...".to_string(),
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

    let loader_version = index.dependencies.get("fabric-loader")
        .ok_or_else(|| "Missing 'fabric-loader' dependency in modpack (only Fabric modpacks supported)".to_string())?;

    // ── Phase 3: Create instance ───────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "parsing".to_string(),
        current: 1,
        total: 1,
        message: format!("Tworzenie instancji {}...", mc_version),
    });

    // Build CreateInstanceInput
    let create_input = crate::manifest::CreateInstanceInput {
        name: input.name.clone(),
        mc_version: mc_version.clone(),
        loader: "fabric".to_string(),
        loader_version: loader_version.clone(),
        java_version: input.java_version.clone(),
        custom_java_path: input.custom_java_path.clone(),
        ram: input.ram,
        jvm_args: input.jvm_args.clone(),
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
        message: format!("Pobieranie {} plików...", total_files),
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
                message: format!("Pomijanie '{}' (niewymagane na kliencie)", file_entry.path),
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
                    message: format!("Brak URL dla '{}'", file_entry.path),
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
                    message: format!("Błąd tworzenia katalogu: {}", e),
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
                            if let Err(e) = fs::write(&target_path, &file_bytes) {
                                errors += 1;
                                emit_progress(&app_handle, ModpackProgressEvent {
                                    phase: "downloading_files".to_string(),
                                    current: downloaded + skipped + errors,
                                    total: total_files,
                                    message: format!("Błąd zapisu '{}': {}", file_entry.path, e),
                                });
                            } else {
                                downloaded += 1;
                            }
                        }
                        Err(e) => {
                            errors += 1;
                            emit_progress(&app_handle, ModpackProgressEvent {
                                phase: "downloading_files".to_string(),
                                current: downloaded + skipped + errors,
                                total: total_files,
                                message: format!("Błąd odczytu '{}': {}", file_entry.path, e),
                            });
                        }
                    }
                } else {
                    errors += 1;
                    emit_progress(&app_handle, ModpackProgressEvent {
                        phase: "downloading_files".to_string(),
                        current: downloaded + skipped + errors,
                        total: total_files,
                        message: format!("HTTP {} dla '{}'", resp.status(), file_entry.path),
                    });
                }
            }
            Err(e) => {
                errors += 1;
                emit_progress(&app_handle, ModpackProgressEvent {
                    phase: "downloading_files".to_string(),
                    current: downloaded + skipped + errors,
                    total: total_files,
                    message: format!("Błąd pobierania '{}': {}", file_entry.path, e),
                });
            }
        }
    }

    // ── Phase 5: Copy overrides/ ───────────────────────────────────
    let mut overrides_copied = false;

    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "copying_overrides".to_string(),
        current: 0,
        total: 1,
        message: "Kopiowanie konfiguracji...".to_string(),
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

        let target_path = if entry.is_dir() {
            overrides_temp.join(relative_path)
        } else {
            overrides_temp.join(relative_path)
        };

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
                    message: format!("Błąd kopiowania konfiguracji: {}", e),
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
            "Konfiguracja skopiowana".to_string()
        } else {
            "Brak dodatkowej konfiguracji".to_string()
        },
    });

    // ── Phase 6: Cleanup ───────────────────────────────────────────
    let _ = fs::remove_dir_all(&temp_dir);

    // ── Done ───────────────────────────────────────────────────────
    emit_progress(&app_handle, ModpackProgressEvent {
        phase: "done".to_string(),
        current: total_files,
        total: total_files,
        message: format!(
            "Gotowe! Pobrano {}, pominięto {}, błędów: {}",
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
