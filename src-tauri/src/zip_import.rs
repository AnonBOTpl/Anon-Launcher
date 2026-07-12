use crate::instance_manager;
use crate::manifest::{ManifestError, ManifestErrorCode};
use crate::manifest_migration;
use crate::sanitize::sanitize_name;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

/// Result of validating a ZIP file before import
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipValidation {
    pub instance_name: String,
    pub schema_version: u32,
    pub needs_migration: bool,
}

/// Validate a ZIP file to ensure it contains a valid instance manifest.
/// Does not extract anything - just reads and validates the manifest.
pub fn validate_import_zip(zip_path: &Path) -> Result<ZipValidation, ManifestError> {
    let file = fs::File::open(zip_path).map_err(|e| ManifestError {
        code: ManifestErrorCode::NotFound,
        message: format!("Failed to open ZIP file: {}", e),
    })?;

    let mut archive = ZipArchive::new(file).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read ZIP archive: {}", e),
    })?;

    // Find and read instance.json from the ZIP
    let content = read_manifest_from_zip(&mut archive)?;

    let data: Value = serde_json::from_str(&content).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to parse manifest JSON from ZIP: {}", e),
    })?;

    // Check schema version
    if !manifest_migration::has_schema_version(&data) {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: "ZIP does not contain a valid manifest with schemaVersion".to_string(),
        });
    }

    let current_sv = data
        .get("schemaVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    let needs_migration = current_sv < crate::manifest::CURRENT_SCHEMA_VERSION;

    // Get instance name from manifest
    let instance_name = data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(ZipValidation {
        instance_name,
        schema_version: current_sv,
        needs_migration,
    })
}

/// Import an instance from a ZIP file.
/// Extracts all files, validates the manifest, creates the instance directory.
pub fn import_instance(
    app_data_dir: &Path,
    zip_path: &Path,
    new_name: Option<&str>,
) -> Result<(), ManifestError> {
    let file = fs::File::open(zip_path).map_err(|e| ManifestError {
        code: ManifestErrorCode::NotFound,
        message: format!("Failed to open ZIP file: {}", e),
    })?;

    let mut archive = ZipArchive::new(file).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read ZIP archive: {}", e),
    })?;

    // Find and read the manifest first
    let manifest_idx = find_manifest_entry_index(&mut archive)?;

    let manifest_content = {
        let mut entry = archive.by_index(manifest_idx).map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to read manifest from ZIP: {}", e),
        })?;

        let mut content = String::new();
        std::io::Read::read_to_string(&mut entry, &mut content).map_err(|e| {
            ManifestError {
                code: ManifestErrorCode::ParseError,
                message: format!("Failed to read manifest content: {}", e),
            }
        })?;
        content
    };

    // Validate and migrate manifest
    let data: Value = serde_json::from_str(&manifest_content).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to parse manifest JSON: {}", e),
    })?;

    let (mut manifest, migrated) = manifest_migration::migrate_manifest(data)?;

    // Use custom name if provided
    if let Some(name) = new_name {
        manifest.name = name.to_string();
    }

    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    let sanitized = sanitize_name(&manifest.name);
    let instance_dir = instances_dir.join(&sanitized);

    // Check if instance already exists
    if instance_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: format!("Instance '{}' already exists", manifest.name),
        });
    }

    // Create instance directory
    fs::create_dir_all(&instance_dir).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to create instance directory: {}", e),
    })?;

    // Extract all files from ZIP
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to read ZIP entry: {}", e),
        })?;

        let entry_path = entry.name().to_string();

        // Skip the manifest entry - we'll write it separately
        if entry_path == "instance.json"
            || entry_path.ends_with("/instance.json")
        {
            continue;
        }

        // Determine the output path (strip any leading directory from the ZIP)
        let relative_path = strip_top_level_dir(&entry_path);

        // ── Zip Slip protection ────────────────────────────────────
        // Reject paths that try to escape the instance directory via ".."
        if !is_safe_relative_path(&relative_path) {
            return Err(ManifestError {
                code: ManifestErrorCode::InvalidSchema,
                message: format!("Blocked unsafe path in ZIP: '{}'", entry_path),
            });
        }

        let output_path = instance_dir.join(&relative_path);

        if entry.is_dir() {
            fs::create_dir_all(&output_path).ok();
        } else {
            // Create parent directories
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).ok();
            }

            let mut output_file = fs::File::create(&output_path).map_err(|e| {
                ManifestError {
                    code: ManifestErrorCode::ParseError,
                    message: format!("Failed to create file: {}", e),
                }
            })?;

            std::io::copy(&mut entry, &mut output_file).map_err(|e| {
                ManifestError {
                    code: ManifestErrorCode::ParseError,
                    message: format!("Failed to extract file: {}", e),
                }
            })?;
        }
    }

    // If migration occurred, write migrated manifest
    if migrated {
        instance_manager::write_manifest_to_disk(&instance_dir, &manifest)?;
    }

    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────

/// Check if a relative path is safe (no parent dir traversal, no absolute paths).
/// Prevents Zip Slip vulnerability where entry paths like "../../etc/harmful"
/// could escape the intended extraction directory.
fn is_safe_relative_path(path: &str) -> bool {
    let normalized = path.replace('\\', "/");
    for component in normalized.split('/') {
        match component {
            ".." => return false,
            "~" => return false,
            "" | "." => continue,
            _ => {
                // Also reject absolute paths on Unix
                if component.starts_with('/') {
                    return false;
                }
            }
        }
    }
    true
}

/// Strip the top-level directory from a ZIP entry path.
/// ZIPs created by export_instance will have entries like "instance.json" or "mods/foo.jar"
/// but other ZIPs might have a top-level folder "MyInstance/instance.json"
fn strip_top_level_dir(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if let Some(pos) = normalized.find('/') {
        normalized[pos + 1..].to_string()
    } else {
        normalized
    }
}

/// Find the instance.json entry index in a ZIP archive
fn find_manifest_entry_index(archive: &mut ZipArchive<fs::File>) -> Result<usize, ManifestError> {
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to read ZIP entry: {}", e),
        })?;

        let name = entry.name().replace('\\', "/");
        if name == "instance.json" || name.ends_with("/instance.json") {
            return Ok(i);
        }
    }

    Err(ManifestError {
        code: ManifestErrorCode::InvalidSchema,
        message: "ZIP does not contain an instance.json manifest".to_string(),
    })
}

/// Find the manifest entry in the ZIP and read its contents as a string.
/// This avoids lifetime issues by not returning a ZipFile.
fn read_manifest_from_zip(archive: &mut ZipArchive<fs::File>) -> Result<String, ManifestError> {
    let idx = find_manifest_entry_index(archive)?;
    let mut entry = archive.by_index(idx).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read manifest from ZIP: {}", e),
    })?;

    let mut content = String::new();
    entry.read_to_string(&mut content).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read manifest content: {}", e),
    })?;

    Ok(content)
}
