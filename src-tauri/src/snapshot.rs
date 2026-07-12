use crate::instance_manager;
use crate::manifest::ManifestError;
use crate::sanitize::sanitize_name;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Snapshot metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub timestamp: String,
    pub mode: String,
    pub size_bytes: u64,
    pub mod_count: usize,
    pub created_at: String,
    pub label: String,
}

/// Result of listing snapshots
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotModInfo {
    pub name: String,
    pub version_id: String,
    pub version_number: String,
    pub enabled: bool,
}

/// Metadata-only snapshot content
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataSnapshot {
    pub created_at: String,
    pub manifest: serde_json::Value,
    pub mods: Vec<SnapshotModInfo>,
}

/// Restore result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored_manifest: bool,
    pub restored_mods: bool,
    pub warning: Option<String>,
}

fn get_snapshots_dir(app_data_dir: &Path, instance_name: &str) -> PathBuf {
    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    instances_dir
        .join(sanitize_name(instance_name))
        .join("snapshots")
}

fn get_timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();

    let days = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    let mut y = 1970i64;
    let mut remaining = days as i64;

    loop {
        let days_in_year = if is_leap_year(y as u32) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let days_in_months = if is_leap_year(y as u32) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 1usize;
    for &dm in days_in_months.iter() {
        if remaining < dm {
            break;
        }
        remaining -= dm;
        m += 1;
    }

    format!(
        "{:04}-{:02}-{:02}T{:02}-{:02}-{:02}",
        y, m, remaining + 1, hours, minutes, seconds
    )
}

fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

fn dir_size(path: &Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    if path.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                total += dir_size(&path)?;
            } else {
                total += entry.metadata()?.len();
            }
        }
    }
    Ok(total)
}

fn count_mod_files(instance_dir: &Path) -> usize {
    let mods_dir = instance_dir.join("mods");
    if !mods_dir.exists() {
        return 0;
    }
    let mut count = 0;
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".jar") || name.ends_with(".jar.disabled") {
                count += 1;
            }
        }
    }
    count
}

/// mods.json is at <instance_dir>/mods/mods.json with format { "mods": [...] }
fn read_mods_registry(instance_dir: &Path) -> Vec<SnapshotModInfo> {
    let mods_json = instance_dir.join("mods").join("mods.json");
    if !mods_json.exists() {
        return Vec::new();
    }
    if let Ok(content) = fs::read_to_string(&mods_json) {
        // Parse as a generic JSON object first, then extract "mods" array
        if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(arr) = obj.get("mods").and_then(|v| v.as_array()) {
                return arr
                    .iter()
                    .filter_map(|m| {
                        Some(SnapshotModInfo {
                            name: m.get("name")?.as_str()?.to_string(),
                            version_id: m
                                .get("versionId")
                                .or_else(|| m.get("version_id"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            version_number: m
                                .get("versionNumber")
                                .or_else(|| m.get("version_number"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            enabled: m
                                .get("enabled")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(true),
                        })
                    })
                    .collect();
            }
        }
    }
    Vec::new()
}

fn read_instance_json(instance_dir: &Path) -> Option<serde_json::Value> {
    let path = instance_dir.join("instance.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str(&content) {
                return Some(data);
            }
        }
    }
    None
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() && entry.file_name() == "snapshots" {
            continue;
        }

        if file_type.is_dir() {
            copy_dir(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn enforce_max_snapshots(snapshots_dir: &Path, max_snapshots: usize) {
    if !snapshots_dir.exists() {
        return;
    }
    let mut entries: Vec<_> = match fs::read_dir(snapshots_dir) {
        Ok(e) => e
            .flatten()
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .collect(),
        Err(_) => return,
    };
    entries.sort_by_key(|e| e.file_name());

    while entries.len() > max_snapshots {
        if let Some(oldest) = entries.first() {
            let _ = fs::remove_dir_all(oldest.path());
            entries.remove(0);
        } else {
            break;
        }
    }
}

pub fn create_snapshot(
    app_data_dir: &Path,
    instance_name: &str,
    mode: &str,
) -> Result<SnapshotInfo, ManifestError> {
    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(instance_name));

    if !instance_dir.exists() {
        return Err(ManifestError {
            code: crate::manifest::ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    let snapshots_dir = get_snapshots_dir(app_data_dir, instance_name);
    let timestamp = get_timestamp();
    let snapshot_dir = snapshots_dir.join(&timestamp);

    fs::create_dir_all(&snapshot_dir).map_err(|e| ManifestError {
        code: crate::manifest::ManifestErrorCode::ParseError,
        message: format!("Failed to create snapshot directory: {}", e),
    })?;

    let mod_count = count_mod_files(&instance_dir);
    let now = chrono_now_human();

    match mode {
        "full" => {
            copy_dir(&instance_dir, &snapshot_dir).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to create full snapshot: {}", e),
            })?;
        }
        "metadata" => {
            let manifest = read_instance_json(&instance_dir);
            let mods = read_mods_registry(&instance_dir);

            let metadata = MetadataSnapshot {
                created_at: now.clone(),
                manifest: manifest.unwrap_or(serde_json::Value::Null),
                mods,
            };

            let json = serde_json::to_string_pretty(&metadata).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to serialize metadata: {}", e),
            })?;

            fs::write(&snapshot_dir.join("metadata.json"), json).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to write metadata: {}", e),
            })?;
        }
        _ => {
            let _ = fs::remove_dir_all(&snapshot_dir);
            return Err(ManifestError {
                code: crate::manifest::ManifestErrorCode::InvalidSchema,
                message: format!("Invalid snapshot mode: {}. Use 'full' or 'metadata'.", mode),
            });
        }
    }

    let size = dir_size(&snapshot_dir).unwrap_or(0);
    enforce_max_snapshots(&snapshots_dir, 10);

    Ok(SnapshotInfo {
        timestamp,
        mode: mode.to_string(),
        size_bytes: size,
        mod_count,
        created_at: now,
        label: format!(
            "{} — {} modów",
            if mode == "full" {
                "Pełna kopia"
            } else {
                "Tylko metadane"
            },
            mod_count,
        ),
    })
}

pub fn list_snapshots(
    app_data_dir: &Path,
    instance_name: &str,
) -> Result<Vec<SnapshotInfo>, ManifestError> {
    let snapshots_dir = get_snapshots_dir(app_data_dir, instance_name);

    if !snapshots_dir.exists() {
        return Ok(Vec::new());
    }

    let mut snapshots = Vec::new();

    let mut entries: Vec<_> = match fs::read_dir(&snapshots_dir) {
        Ok(e) => e
            .flatten()
            .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
            .collect(),
        Err(_) => return Ok(Vec::new()),
    };

    entries.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    for entry in entries {
        let timestamp = entry.file_name().to_string_lossy().to_string();
        let snapshot_dir = entry.path();

        let has_full_copy = snapshot_dir.join("instance.json").exists();
        let is_metadata = snapshot_dir.join("metadata.json").exists();

        let mode = if has_full_copy {
            "full".to_string()
        } else if is_metadata {
            "metadata".to_string()
        } else {
            continue;
        };

        let size = dir_size(&snapshot_dir).unwrap_or(0);
        let mod_count = if has_full_copy {
            count_mod_files(&snapshot_dir)
        } else {
            if let Ok(content) = fs::read_to_string(&snapshot_dir.join("metadata.json")) {
                if let Ok(meta) = serde_json::from_str::<MetadataSnapshot>(&content) {
                    meta.mods.len()
                } else {
                    0
                }
            } else {
                0
            }
        };

        let created_at = timestamp.replace('T', " ").replace('-', "-");

        let mode_clone = mode.clone();
        snapshots.push(SnapshotInfo {
            timestamp,
            mode,
            size_bytes: size,
            mod_count,
            created_at,
            label: format!(
                "{} — {} modów",
                if mode_clone == "full" {
                    "Pełna kopia"
                } else {
                    "Tylko metadane"
                },
                mod_count,
            ),
        });
    }

    Ok(snapshots)
}

pub fn delete_snapshot(
    app_data_dir: &Path,
    instance_name: &str,
    timestamp: &str,
) -> Result<(), ManifestError> {
    let snapshots_dir = get_snapshots_dir(app_data_dir, instance_name);
    let snapshot_dir = snapshots_dir.join(sanitize_name(timestamp));

    if !snapshot_dir.exists() {
        return Err(ManifestError {
            code: crate::manifest::ManifestErrorCode::NotFound,
            message: format!("Snapshot '{}' not found", timestamp),
        });
    }

    fs::remove_dir_all(&snapshot_dir).map_err(|e| ManifestError {
        code: crate::manifest::ManifestErrorCode::ParseError,
        message: format!("Failed to delete snapshot: {}", e),
    })?;

    Ok(())
}

pub fn restore_snapshot(
    app_data_dir: &Path,
    instance_name: &str,
    timestamp: &str,
    mode: &str,
) -> Result<RestoreResult, ManifestError> {
    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(instance_name));
    let snapshots_dir = get_snapshots_dir(app_data_dir, instance_name);
    let snapshot_dir = snapshots_dir.join(timestamp);

    if !snapshot_dir.exists() {
        return Err(ManifestError {
            code: crate::manifest::ManifestErrorCode::NotFound,
            message: format!("Snapshot '{}' not found", timestamp),
        });
    }

    if !instance_dir.exists() {
        return Err(ManifestError {
            code: crate::manifest::ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    match mode {
        "full" => {
            for entry in fs::read_dir(&instance_dir).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to read instance directory: {}", e),
            })? {
                let entry = entry.map_err(|e| ManifestError {
                    code: crate::manifest::ManifestErrorCode::ParseError,
                    message: format!("Failed to read entry: {}", e),
                })?;
                let path = entry.path();
                if entry.file_name() != "snapshots" {
                    if path.is_dir() {
                        fs::remove_dir_all(&path).map_err(|e| ManifestError {
                            code: crate::manifest::ManifestErrorCode::ParseError,
                            message: format!("Failed to remove: {}", e),
                        })?;
                    } else {
                        fs::remove_file(&path).map_err(|e| ManifestError {
                            code: crate::manifest::ManifestErrorCode::ParseError,
                            message: format!("Failed to remove: {}", e),
                        })?;
                    }
                }
            }

            for entry in fs::read_dir(&snapshot_dir).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to read snapshot directory: {}", e),
            })? {
                let entry = entry.map_err(|e| ManifestError {
                    code: crate::manifest::ManifestErrorCode::ParseError,
                    message: format!("Failed to read entry: {}", e),
                })?;
                let src_path = entry.path();
                let dst_path = instance_dir.join(entry.file_name());

                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    copy_dir(&src_path, &dst_path).map_err(|e| ManifestError {
                        code: crate::manifest::ManifestErrorCode::ParseError,
                        message: format!("Failed to copy: {}", e),
                    })?;
                } else {
                    fs::copy(&src_path, &dst_path).map_err(|e| ManifestError {
                        code: crate::manifest::ManifestErrorCode::ParseError,
                        message: format!("Failed to copy: {}", e),
                    })?;
                }
            }

            Ok(RestoreResult {
                restored_manifest: true,
                restored_mods: true,
                warning: None,
            })
        }
        "metadata" => {
            let metadata_path = snapshot_dir.join("metadata.json");
            if !metadata_path.exists() {
                return Err(ManifestError {
                    code: crate::manifest::ManifestErrorCode::NotFound,
                    message: "Metadata file not found in snapshot".to_string(),
                });
            }

            let content = fs::read_to_string(&metadata_path).map_err(|e| ManifestError {
                code: crate::manifest::ManifestErrorCode::ParseError,
                message: format!("Failed to read metadata: {}", e),
            })?;

            let metadata: MetadataSnapshot =
                serde_json::from_str(&content).map_err(|e| ManifestError {
                    code: crate::manifest::ManifestErrorCode::ParseError,
                    message: format!("Failed to parse metadata: {}", e),
                })?;

            let manifest_restored = if !metadata.manifest.is_null() {
                let json =
                    serde_json::to_string_pretty(&metadata.manifest).map_err(|e| ManifestError {
                        code: crate::manifest::ManifestErrorCode::ParseError,
                        message: format!("Failed to serialize manifest: {}", e),
                    })?;
                fs::write(&instance_dir.join("instance.json"), json).is_ok()
            } else {
                false
            };

            // Wrap in { "mods": [...] } to match mod_installer.rs ModsRegistry format
            let mods_registry = serde_json::json!({ "mods": &metadata.mods });
            let mods_json =
                serde_json::to_string_pretty(&mods_registry).unwrap_or_default();
            let mods_restored =
                fs::write(&instance_dir.join("mods.json"), mods_json).is_ok();

            let warning = if metadata.mods.is_empty() {
                None
            } else {
                Some(
                    "Przywrócono tylko listę modów. Pliki JAR nie zostały przywrócone — \
                     musisz ręcznie pobrać odpowiednie wersje."
                        .to_string(),
                )
            };

            Ok(RestoreResult {
                restored_manifest: manifest_restored,
                restored_mods: mods_restored,
                warning,
            })
        }
        _ => Err(ManifestError {
            code: crate::manifest::ManifestErrorCode::InvalidSchema,
            message: format!(
                "Invalid restore mode: {}. Use 'full' or 'metadata'.",
                mode
            ),
        }),
    }
}

fn chrono_now_human() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let days = secs / 86400;

    let mut y = 1970i64;
    let mut remaining = days as i64;

    loop {
        let days_in_year = if is_leap_year(y as u32) { 366 } else { 365 };
        if remaining < days_in_year {
            break;
        }
        remaining -= days_in_year;
        y += 1;
    }

    let days_in_months = if is_leap_year(y as u32) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 1usize;
    for &dm in days_in_months.iter() {
        if remaining < dm {
            break;
        }
        remaining -= dm;
        m += 1;
    }

    format!("{:04}-{:02}-{:02}", y, m, remaining + 1)
}
