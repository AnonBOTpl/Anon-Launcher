use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::sanitize::sanitize_name;

// ─── Types ──────────────────────────────────────────────────────────

/// Metadata for a content item (resource pack or shader)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentMetadata {
    pub file_name: String,
    pub title: Option<String>,
    pub version_id: Option<String>,
    pub version_number: Option<String>,
    pub project_slug: Option<String>,
    pub icon_url: Option<String>,
}

/// A file installed in a content folder (resourcepacks, shaderpacks)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledContent {
    pub file_name: String,
    pub size: u64,
    pub modified_at: String,
    #[serde(flatten)]
    pub metadata: ContentMetadata,
}

// ─── Registry helpers ───────────────────────────────────────────────

/// Content registry key: `{folder}/{file_name}`
fn registry_key(folder: &str, file_name: &str) -> String {
    format!("{}/{}", folder, file_name)
}

fn registry_path(app_data_dir: &std::path::Path, instance_name: &str) -> PathBuf {
    let instances_dir = app_data_dir.join("instances");
    instances_dir
        .join(sanitize_name(instance_name))
        .join("content_registry.json")
}

fn read_registry(app_data_dir: &std::path::Path, instance_name: &str) -> Result<HashMap<String, ContentMetadata>, String> {
    let path = registry_path(app_data_dir, instance_name);
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read content registry: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse content registry: {}", e))
}

fn write_registry(app_data_dir: &std::path::Path, instance_name: &str, registry: &HashMap<String, ContentMetadata>) -> Result<(), String> {
    let path = registry_path(app_data_dir, instance_name);
    // Ensure parent dir exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create registry dir: {}", e))?;
    }
    let content = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("Failed to serialize registry: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write registry: {}", e))?;
    Ok(())
}

/// Register or update metadata for a content item.
pub fn register_content_metadata(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
    file_name: &str,
    title: Option<String>,
    version_id: Option<String>,
    version_number: Option<String>,
    project_slug: Option<String>,
    icon_url: Option<String>,
) -> Result<(), String> {
    let mut registry = read_registry(app_data_dir, instance_name)?;
    let key = registry_key(folder, file_name);
    registry.insert(key, ContentMetadata {
        file_name: file_name.to_string(),
        title,
        version_id,
        version_number,
        project_slug,
        icon_url,
    });
    write_registry(app_data_dir, instance_name, &registry)
}

/// Remove metadata from registry for a content item.
pub fn remove_content_metadata(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
    file_name: &str,
) -> Result<(), String> {
    let mut registry = read_registry(app_data_dir, instance_name)?;
    let key = registry_key(folder, file_name);
    registry.remove(&key);
    write_registry(app_data_dir, instance_name, &registry)
}

// ─── Helpers ────────────────────────────────────────────────────────

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
/// Additionally registers metadata if provided.
pub fn install_content(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
    file_name: &str,
    download_url: &str,
    title: Option<String>,
    version_id: Option<String>,
    version_number: Option<String>,
    project_slug: Option<String>,
    icon_url: Option<String>,
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

    // Register metadata
    register_content_metadata(
        app_data_dir,
        instance_name,
        folder,
        file_name,
        title.clone(),
        version_id.clone(),
        version_number.clone(),
        project_slug.clone(),
        icon_url.clone(),
    )?;

    let file_metadata = fs::metadata(&target_path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    Ok(InstalledContent {
        file_name: file_name.to_string(),
        size: file_metadata.len(),
        modified_at: now_iso(),
        metadata: ContentMetadata {
            file_name: file_name.to_string(),
            title,
            version_id,
            version_number,
            project_slug,
            icon_url,
        },
    })
}

/// List all files in the instance's content folder.
/// Returns a sorted list of files with their metadata (merged from registry).
pub fn list_content(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    folder: &str,
) -> Result<Vec<InstalledContent>, String> {
    let content_dir = get_content_dir(app_data_dir, instance_name, folder);
    let registry = read_registry(app_data_dir, instance_name)?;

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
                if let Ok(file_meta) = fs::metadata(&path) {
                    let meta = registry.get(&registry_key(folder, name)).cloned().unwrap_or(ContentMetadata {
                        file_name: name.to_string(),
                        title: None,
                        version_id: None,
                        version_number: None,
                        project_slug: None,
                        icon_url: None,
                    });

                    items.push(InstalledContent {
                        file_name: name.to_string(),
                        size: file_meta.len(),
                        modified_at: now_iso(),
                        metadata: meta,
                    });
                }
            }
        }
    }

    // Sort by file name
    items.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));

    Ok(items)
}

/// Remove a content file from the instance's folder and its metadata.
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

    // Remove from registry
    let _ = remove_content_metadata(app_data_dir, instance_name, folder, file_name);

    Ok(())
}
