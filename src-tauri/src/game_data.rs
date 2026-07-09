use base64::Engine;
use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ─── Data Structures ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotInfo {
    pub filename: String,
    pub last_modified: String,
    pub file_size: u64,
    pub path: String,
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

fn instance_dir(app_data_dir: &Path, instance_name: &str) -> PathBuf {
    app_data_dir
        .join("instances")
        .join(sanitize_name(instance_name))
}

fn format_timestamp_from_modified(modified: SystemTime) -> String {
    let duration = modified
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs() as i64;
    let nanos = duration.subsec_nanos();
    DateTime::from_timestamp(secs, nanos)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Recursively compute directory size in bytes.
fn dir_size(path: &Path) -> u64 {
    let mut total = 0u64;
    if path.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    total += dir_size(&entry_path);
                } else if let Ok(meta) = entry.metadata() {
                    total += meta.len();
                }
            }
        }
    }
    total
}

// ─── Public API ─────────────────────────────────────────────────────

/// Get the 3 most recent screenshots from the instance's screenshots/ directory.
pub fn get_recent_screenshots(
    app_data_dir: &Path,
    instance_name: &str,
) -> Result<Vec<ScreenshotInfo>, String> {
    let inst_dir = instance_dir(app_data_dir, instance_name);
    if !inst_dir.exists() {
        return Err(format!("Instance '{}' not found", instance_name));
    }

    let screenshots_dir = inst_dir.join("screenshots");
    if !screenshots_dir.exists() || !screenshots_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut screenshots: Vec<ScreenshotInfo> = Vec::new();

    if let Ok(entries) = fs::read_dir(&screenshots_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let filename = entry
                .file_name()
                .to_string_lossy()
                .to_string();

            // Only include PNG files
            if !filename.to_lowercase().ends_with(".png") {
                continue;
            }

            let metadata = match fs::metadata(&path) {
                Ok(m) => m,
                _ => continue,
            };

            let last_modified = metadata
                .modified()
                .ok()
                .map(format_timestamp_from_modified)
                .unwrap_or_else(|| "unknown".to_string());

            screenshots.push(ScreenshotInfo {
                filename,
                last_modified,
                file_size: metadata.len(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    // Sort by modification time descending (newest first), take top 3
    screenshots.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    screenshots.truncate(3);

    Ok(screenshots)
}

/// Read an image file and return it as a base64 data URI.
pub fn read_image_as_base64(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let bytes = fs::read(file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Detect MIME type from extension
    let mime = match file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

/// Compute the total size of the instance directory (excluding snapshots/).
pub fn get_instance_size(
    app_data_dir: &Path,
    instance_name: &str,
) -> Result<u64, String> {
    let inst_dir = instance_dir(app_data_dir, instance_name);
    if !inst_dir.exists() {
        return Err(format!("Instance '{}' not found", instance_name));
    }

    let mut total = 0u64;

    if let Ok(entries) = fs::read_dir(&inst_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // Skip snapshots directory to avoid double-counting
            if entry.file_name() == "snapshots" {
                continue;
            }
            if path.is_dir() {
                total += dir_size(&path);
            } else if let Ok(meta) = entry.metadata() {
                total += meta.len();
            }
        }
    }

    Ok(total)
}
