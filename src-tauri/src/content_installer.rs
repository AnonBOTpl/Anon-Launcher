use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ─── Types ──────────────────────────────────────────────────────────

/// A file installed in a content folder (resourcepacks, shaderpacks)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledContent {
    pub file_name: String,
    pub size: u64,
    pub modified_at: String,
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

fn get_content_dir(app_data_dir: &std::path::Path, instance_name: &str, folder: &str) -> PathBuf {
    let instances_dir = app_data_dir.join("instances");
    instances_dir
        .join(sanitize_name(instance_name))
        .join(folder)
}

fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let ms = duration.as_millis() % 1000;
    format!("{:02}:{:02}:{:02}.{:03}", (secs / 3600) % 24, (secs / 60) % 60, secs % 60, ms)
}

// ─── Public API ─────────────────────────────────────────────────────

/// Install a content file (resource pack or shader) into the instance's folder.
/// The file is downloaded from the given URL and saved to `{instanceDir}/{folder}/{fileName}`.
pub fn install_content(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
    file_name: &str,
    download_url: &str,
) -> Result<InstalledContent, String> {
    let content_dir = get_content_dir(app_data_dir, instance_name, folder);

    // Ensure content directory exists
    fs::create_dir_all(&content_dir)
        .map_err(|e| format!("Failed to create {} dir: {}", folder, e))?;

    let target_path = content_dir.join(file_name);

    // Download the file
    let response = reqwest::blocking::get(download_url)
        .map_err(|e| format!("Failed to download {}: {}", file_name, e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Remove existing file with same name if it exists (reinstall)
    if target_path.exists() {
        fs::remove_file(&target_path)
            .map_err(|e| format!("Failed to remove existing file: {}", e))?;
    }

    fs::write(&target_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    let metadata = fs::metadata(&target_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    Ok(InstalledContent {
        file_name: file_name.to_string(),
        size: metadata.len(),
        modified_at: now_iso(),
    })
}

/// List all files in the instance's content folder.
/// Returns a sorted list of files with their metadata.
pub fn list_content(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
) -> Result<Vec<InstalledContent>, String> {
    let content_dir = get_content_dir(app_data_dir, instance_name, folder);

    if !content_dir.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();

    let entries = fs::read_dir(&content_dir)
        .map_err(|e| format!("Failed to read {} dir: {}", folder, e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if let Ok(metadata) = fs::metadata(&path) {
                    items.push(InstalledContent {
                        file_name: name.to_string(),
                        size: metadata.len(),
                        modified_at: now_iso(),
                    });
                }
            }
        }
    }

    // Sort by file name
    items.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));

    Ok(items)
}

/// Remove a content file from the instance's folder.
pub fn remove_content(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
    file_name: &str,
) -> Result<(), String> {
    let content_dir = get_content_dir(app_data_dir, instance_name, folder);
    let target_path = content_dir.join(file_name);

    if !target_path.exists() {
        return Err(format!("File '{}' not found in {}", file_name, folder));
    }

    fs::remove_file(&target_path)
        .map_err(|e| format!("Failed to remove file: {}", e))?;

    Ok(())
}
