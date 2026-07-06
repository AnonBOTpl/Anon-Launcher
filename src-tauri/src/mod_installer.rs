use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

// ─── Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledMod {
    pub name: String,
    pub version_id: String,
    pub file_name: String,
    pub enabled: bool,
    pub installed_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModsRegistry {
    mods: Vec<InstalledMod>,
}

// ─── Helpers ────────────────────────────────────────────────────────

fn get_instance_mods_dir(app_data_dir: &std::path::Path, instance_name: &str) -> PathBuf {
    let instances_dir = app_data_dir.join("instances");
    instances_dir
        .join(sanitize_name(instance_name))
        .join("mods")
}

fn get_registry_path(mods_dir: &std::path::Path) -> PathBuf {
    mods_dir.join("mods.json")
}

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

fn now_iso() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();
    let ms = duration.as_millis() % 1000;
    format!("{}Z", secs as f64 + ms as f64 / 1000.0)
}

fn read_registry(mods_dir: &std::path::Path) -> ModsRegistry {
    let path = get_registry_path(mods_dir);
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(ModsRegistry { mods: Vec::new() })
    } else {
        ModsRegistry { mods: Vec::new() }
    }
}

fn write_registry(mods_dir: &std::path::Path, registry: &ModsRegistry) -> Result<(), String> {
    let path = get_registry_path(mods_dir);
    let json = serde_json::to_string_pretty(registry).map_err(|e| format!("JSON error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write mods.json: {}", e))
}

/// Derive a display name from a file name (e.g. "sodium-fabric-0.6.0.jar" → "Sodium Fabric 0.6.0")
fn derive_name_from_filename(file_name: &str) -> String {
    let stem = file_name
        .trim_end_matches(".jar.disabled")
        .trim_end_matches(".jar");
    stem.replace(['_', '-'], " ")
        .split_whitespace()
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Sync the registry with actual files on disk:
/// - Removes registry entries whose files no longer exist
/// - Adds entries for orphan .jar / .jar.disabled files found on disk
/// - Writes the cleaned-up registry
fn sync_registry_with_filesystem(mods_dir: &std::path::Path) -> Vec<InstalledMod> {
    if !mods_dir.exists() {
        return Vec::new();
    }

    let mut registry = read_registry(mods_dir);

    // Collect all .jar and .jar.disabled files on disk
    let mut disk_files: HashSet<String> = HashSet::new();
    if let Ok(entries) = fs::read_dir(mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.ends_with(".jar") || name.ends_with(".jar.disabled") {
                        disk_files.insert(name.to_string());
                    }
                }
            }
        }
    }

    // Remove registry entries whose files no longer exist
    registry.mods.retain(|m| disk_files.contains(&m.file_name));

    // Collect current registry file names for lookup
    let registry_names: HashSet<String> =
        registry.mods.iter().map(|m| m.file_name.clone()).collect();

    // Add orphan files from disk that aren't in registry
    for file_name in &disk_files {
        if !registry_names.contains(file_name) {
            let enabled = !file_name.ends_with(".disabled");
            registry.mods.push(InstalledMod {
                name: derive_name_from_filename(file_name),
                version_id: String::new(),
                file_name: file_name.clone(),
                enabled,
                installed_at: now_iso(),
                project_slug: None,
                icon_url: None,
            });
        }
    }

    // Write the updated registry
    let _ = write_registry(mods_dir, &registry);

    registry.mods
}

// ─── Public API ─────────────────────────────────────────────────────

/// Install a mod from Modrinth into the instance's mods folder.
pub fn install_mod(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    version_id: String,
    download_url: String,
    file_name: String,
    mod_name: String,
    project_slug: Option<String>,
    icon_url: Option<String>,
) -> Result<InstalledMod, String> {
    let mods_dir = get_instance_mods_dir(app_data_dir, instance_name);

    // Ensure mods directory exists
    fs::create_dir_all(&mods_dir).map_err(|e| format!("Failed to create mods dir: {}", e))?;

    // Download the JAR file
    let jar_path = mods_dir.join(&file_name);

    let response = reqwest::blocking::get(&download_url)
        .map_err(|e| format!("Failed to download mod: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    fs::write(&jar_path, &bytes).map_err(|e| format!("Failed to write JAR: {}", e))?;

    // Sync registry with filesystem first (catches orphan files)
    let mut registry_mutex = read_registry(&mods_dir);

    // Remove existing entry with same file name (reinstall)
    registry_mutex.mods.retain(|m| m.file_name != file_name);

    let installed_mod = InstalledMod {
        name: mod_name,
        version_id,
        file_name,
        enabled: true,
        installed_at: now_iso(),
        project_slug,
        icon_url,
    };

    registry_mutex.mods.push(installed_mod.clone());
    write_registry(&mods_dir, &registry_mutex)?;

    Ok(installed_mod)
}

/// List all installed mods for an instance (syncs with filesystem first).
pub fn list_mods(
    app_data_dir: &std::path::Path,
    instance_name: &str,
) -> Result<Vec<InstalledMod>, String> {
    let mods_dir = get_instance_mods_dir(app_data_dir, instance_name);

    if !mods_dir.exists() {
        return Ok(Vec::new());
    }

    Ok(sync_registry_with_filesystem(&mods_dir))
}

/// Toggle a mod's enabled/disabled state.
/// Enabled = .jar, Disabled = .jar.disabled
pub fn toggle_mod(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    file_name: String,
    enabled: bool,
) -> Result<InstalledMod, String> {
    let mods_dir = get_instance_mods_dir(app_data_dir, instance_name);
    let mut registry = read_registry(&mods_dir);

    // Find by index to avoid iterator borrow conflicts with write_registry
    let idx = registry
        .mods
        .iter()
        .position(|m| m.file_name == file_name)
        .ok_or_else(|| format!("Mod '{}' not found in registry", file_name))?;

    if registry.mods[idx].enabled == enabled {
        return Ok(registry.mods[idx].clone());
    }

    // Rename the file on disk
    let old_path = mods_dir.join(&file_name);
    let new_name = if enabled {
        file_name.trim_end_matches(".disabled").to_string()
    } else {
        format!("{}.disabled", file_name)
    };
    let new_path = mods_dir.join(&new_name);

    if old_path.exists() {
        fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Failed to rename mod file: {}", e))?;
    } else {
        return Err(format!("Mod file not found on disk: {:?}", old_path));
    }

    // Update registry entry
    let updated = InstalledMod {
        name: registry.mods[idx].name.clone(),
        version_id: registry.mods[idx].version_id.clone(),
        file_name: new_name,
        enabled,
        installed_at: registry.mods[idx].installed_at.clone(),
        project_slug: registry.mods[idx].project_slug.clone(),
        icon_url: registry.mods[idx].icon_url.clone(),
    };
    registry.mods[idx] = updated.clone();

    write_registry(&mods_dir, &registry)?;

    Ok(updated)
}

/// Remove a mod (delete file + remove from registry).
pub fn remove_mod(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    file_name: String,
) -> Result<(), String> {
    let mods_dir = get_instance_mods_dir(app_data_dir, instance_name);
    let mut registry = read_registry(&mods_dir);

    // Remove from registry
    registry.mods.retain(|m| m.file_name != file_name);
    write_registry(&mods_dir, &registry)?;

    // Delete the file if it exists
    let jar_path = mods_dir.join(&file_name);
    if jar_path.exists() {
        fs::remove_file(&jar_path).map_err(|e| format!("Failed to delete mod file: {}", e))?;
    }

    Ok(())
}
