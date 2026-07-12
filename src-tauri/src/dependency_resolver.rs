use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::sanitize::sanitize_name;

// ─── Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyStatus {
    /// The project ID of the dependency on Modrinth
    pub project_id: String,
    /// Dependency type: required, optional, incompatible, embedded
    pub dependency_type: String,
    /// Optional version ID constraint
    pub version_id: Option<String>,
    /// Whether this dependency is installed in the instance
    pub installed: bool,
    /// The installed mod name (if installed)
    pub installed_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveDependenciesResult {
    /// All dependency entries (including those already installed)
    pub dependencies: Vec<DependencyStatus>,
    /// Whether a circular dependency was detected
    pub circular_detected: bool,
    /// List of projects visited during resolution (for cycle detection)
    pub visited: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstalledMod {
    pub name: String,
    pub project_slug: Option<String>,
    pub file_name: String,
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

fn read_registry(mods_dir: &std::path::Path) -> ModsRegistry {
    let path = mods_dir.join("mods.json");
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(ModsRegistry { mods: Vec::new() })
    } else {
        ModsRegistry { mods: Vec::new() }
    }
}

/// Check if a project_id is already installed in the instance.
/// Returns (installed, installed_name) tuple.
fn check_installed(registry: &ModsRegistry, project_id: &str) -> (bool, Option<String>) {
    for mod_entry in &registry.mods {
        if let Some(ref slug) = mod_entry.project_slug {
            if slug == project_id {
                return (true, Some(mod_entry.name.clone()));
            }
        }
    }
    (false, None)
}

/// Scan the filesystem for orphan .jar files that might be dependencies
/// without registry entries, and check if any match a project_id by file name.
fn check_filesystem(mods_dir: &std::path::Path, project_id: &str) -> bool {
    if !mods_dir.exists() {
        return false;
    }

    if let Ok(entries) = fs::read_dir(mods_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    // Check if the file name contains the project slug
                    if name.to_lowercase().contains(&project_id.to_lowercase())
                        && (name.ends_with(".jar") || name.ends_with(".jar.disabled"))
                    {
                        return true;
                    }
                }
            }
        }
    }
    false
}

// ─── Public API ─────────────────────────────────────────────────────

/// Resolve dependencies for a given list of dependency entries.
/// Checks each dependency against the installed mods in the instance.
/// 
/// This does NOT recursively resolve transitive dependencies — that's done
/// on the frontend using the Modrinth API. This command only checks which
/// of the given project IDs are already installed on disk.
pub fn resolve_dependencies(
    app_data_dir: &std::path::Path,
    instance_name: &str,
    dependencies: Vec<serde_json::Value>,
) -> Result<ResolveDependenciesResult, String> {
    let mods_dir = get_instance_mods_dir(app_data_dir, instance_name);
    let registry = read_registry(&mods_dir);

    let mut results = Vec::new();
    let mut visited = Vec::new();

    for dep in &dependencies {
        let project_id = dep.get("projectId")
            .or_else(|| dep.get("project_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if project_id.is_empty() {
            continue;
        }

        let dependency_type = dep.get("dependencyType")
            .or_else(|| dep.get("dependency_type"))
            .and_then(|v| v.as_str())
            .unwrap_or("required")
            .to_string();

        let version_id = dep.get("versionId")
            .or_else(|| dep.get("version_id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Check for circular dependency
        if visited.contains(&project_id) {
            return Ok(ResolveDependenciesResult {
                dependencies: results,
                circular_detected: true,
                visited,
            });
        }
        visited.push(project_id.clone());

        // Check registry first, then filesystem
        let (installed, installed_name) = check_installed(&registry, &project_id);
        let installed = installed || check_filesystem(&mods_dir, &project_id);

        results.push(DependencyStatus {
            project_id,
            dependency_type,
            version_id,
            installed,
            installed_name,
        });
    }

    Ok(ResolveDependenciesResult {
        dependencies: results,
        circular_detected: false,
        visited,
    })
}
