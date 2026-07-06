use crate::manifest::{
    CreateInstanceInput, InstanceManifest, LoaderType, ManifestError, ManifestErrorCode,
    ReadManifestResult,
};
use crate::manifest_migration;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

/// Get the instances directory path within app data
pub fn get_instances_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("instances")
}

/// Get the path to an instance's manifest file
pub fn get_manifest_path(instances_dir: &Path, instance_name: &str) -> PathBuf {
    instances_dir.join(sanitize_name(instance_name)).join("instance.json")
}

/// Sanitize instance name for filesystem use
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

/// Create a new instance directory and manifest file
pub fn create_instance(app_data_dir: &Path, input: CreateInstanceInput) -> Result<InstanceManifest, ManifestError> {
    let loader: LoaderType = LoaderType::try_from(input.loader.as_str())
        .map_err(|e| ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: e,
        })?;

    let now = chrono_now();

    let manifest = InstanceManifest {
        schema_version: crate::manifest::CURRENT_SCHEMA_VERSION,
        name: input.name,
        mc_version: input.mc_version,
        loader,
        loader_version: input.loader_version,
        java_version: input.java_version,
        custom_java_path: input.custom_java_path,
        ram: input.ram,
        jvm_args: input.jvm_args,
        created_at: now.clone(),
        updated_at: now,
    };

    // Validate before saving
    manifest_migration::validate_manifest(&manifest)?;

    let instances_dir = get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(&manifest.name));

    // Create instance directory
    fs::create_dir_all(&instance_dir).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to create instance directory: {}", e),
    })?;

    // Write manifest file
    write_manifest_to_disk(&instance_dir, &manifest)?;

    Ok(manifest)
}

/// Read and migrate a manifest from disk
pub fn read_manifest(app_data_dir: &Path, instance_name: &str) -> Result<ReadManifestResult, ManifestError> {
    let instances_dir = get_instances_dir(app_data_dir);
    let manifest_path = get_manifest_path(&instances_dir, instance_name);

    if !manifest_path.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    let content = fs::read_to_string(&manifest_path).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read manifest file: {}", e),
    })?;

    let data: Value = serde_json::from_str(&content).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to parse manifest JSON: {}", e),
    })?;

    let (manifest, migrated) = manifest_migration::migrate_manifest(data)?;

    // If migration occurred, write updated manifest back to disk
    if migrated {
        write_manifest_to_disk(&manifest_path.parent().unwrap_or(&instances_dir), &manifest)?;
    }

    Ok(ReadManifestResult { manifest, migrated })
}

/// List all instance manifests in the instances directory
pub fn list_instances(app_data_dir: &Path) -> Result<Vec<InstanceManifest>, ManifestError> {
    let instances_dir = get_instances_dir(app_data_dir);

    if !instances_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&instances_dir).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to read instances directory: {}", e),
    })?;

    let mut instances = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to read directory entry: {}", e),
        })?;

        let manifest_path = entry.path().join("instance.json");
        if manifest_path.exists() {
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(data) = serde_json::from_str::<Value>(&content) {
                    if let Ok((manifest, _)) = manifest_migration::migrate_manifest(data) {
                        instances.push(manifest);
                    }
                }
            }
        }
    }

    Ok(instances)
}

/// Delete an instance directory and all its contents
pub fn delete_instance(app_data_dir: &Path, instance_name: &str) -> Result<(), ManifestError> {
    let instances_dir = get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(instance_name));

    if !instance_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    fs::remove_dir_all(&instance_dir).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to delete instance directory: {}", e),
    })?;

    Ok(())
}

/// Clone an instance: copy directory and create new manifest
pub fn clone_instance(
    app_data_dir: &Path,
    source_name: &str,
    new_name: &str,
) -> Result<InstanceManifest, ManifestError> {
    let instances_dir = get_instances_dir(app_data_dir);
    let source_dir = instances_dir.join(sanitize_name(source_name));
    let new_dir = instances_dir.join(sanitize_name(new_name));

    // Validate source exists
    if !source_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Source instance '{}' not found", source_name),
        });
    }

    // Validate new name doesn't exist
    if new_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: format!("Instance '{}' already exists", new_name),
        });
    }

    // Read source manifest
    let source_manifest = read_manifest(app_data_dir, source_name)?;
    let now = chrono_now();

    // Create new manifest with updated fields
    let new_manifest = InstanceManifest {
        schema_version: source_manifest.manifest.schema_version,
        name: new_name.to_string(),
        mc_version: source_manifest.manifest.mc_version.clone(),
        loader: source_manifest.manifest.loader.clone(),
        loader_version: source_manifest.manifest.loader_version.clone(),
        java_version: source_manifest.manifest.java_version.clone(),
        custom_java_path: source_manifest.manifest.custom_java_path.clone(),
        ram: source_manifest.manifest.ram,
        jvm_args: source_manifest.manifest.jvm_args.clone(),
        created_at: now.clone(),
        updated_at: now,
    };

    // Validate new manifest
    manifest_migration::validate_manifest(&new_manifest)?;

    // Copy directory contents
    copy_dir_recursively(&source_dir, &new_dir).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to copy instance directory: {}", e),
    })?;

    // Overwrite manifest file with new one
    write_manifest_to_disk(&new_dir, &new_manifest)?;

    Ok(new_manifest)
}

/// Recursively copy a directory
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

/// Update an existing instance, with optional folder rename
pub fn update_instance(
    app_data_dir: &Path,
    old_name: &str,
    new_manifest: InstanceManifest,
) -> Result<InstanceManifest, ManifestError> {
    let instances_dir = get_instances_dir(app_data_dir);
    let old_dir = instances_dir.join(sanitize_name(old_name));

    if !old_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", old_name),
        });
    }

    manifest_migration::validate_manifest(&new_manifest)?;

    // Read existing manifest to preserve createdAt
    let existing_manifest_path = old_dir.join("instance.json");
    let existing_created_at = if existing_manifest_path.exists() {
        if let Ok(content) = fs::read_to_string(&existing_manifest_path) {
            if let Ok(data) = serde_json::from_str::<Value>(&content) {
                data.get("createdAt")
                    .or_else(|| data.get("created_at"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let now = chrono_now();

    let final_manifest = InstanceManifest {
        schema_version: new_manifest.schema_version,
        name: new_manifest.name,
        mc_version: new_manifest.mc_version,
        loader: new_manifest.loader,
        loader_version: new_manifest.loader_version,
        java_version: new_manifest.java_version,
        custom_java_path: new_manifest.custom_java_path,
        ram: new_manifest.ram,
        jvm_args: new_manifest.jvm_args,
        created_at: existing_created_at.unwrap_or_else(|| now.clone()),
        updated_at: now,
    };

    let name_changed = old_name != final_manifest.name;

    if name_changed {
        let new_dir = instances_dir.join(sanitize_name(&final_manifest.name));

        // Check for name collision
        if new_dir.exists() {
            return Err(ManifestError {
                code: ManifestErrorCode::InvalidSchema,
                message: format!("Instance '{}' already exists", final_manifest.name),
            });
        }

        // Rename the directory
        fs::rename(&old_dir, &new_dir).map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to rename instance directory: {}", e),
        })?;

        write_manifest_to_disk(&new_dir, &final_manifest)?;
    } else {
        write_manifest_to_disk(&old_dir, &final_manifest)?;
    }

    Ok(final_manifest)
}

// ─── Helpers ─────────────────────────────────────────────────────────

/// Write a manifest to disk as JSON
pub fn write_manifest_to_disk(instance_dir: &Path, manifest: &InstanceManifest) -> Result<(), ManifestError> {
    let manifest_path = instance_dir.join("instance.json");
    let json = serde_json::to_string_pretty(manifest).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to serialize manifest: {}", e),
    })?;

    fs::write(&manifest_path, json).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to write manifest file: {}", e),
    })?;

    Ok(())
}

/// Get current date as ISO string (YYYY-MM-DD)
fn chrono_now() -> String {
    // Simple date without chrono dependency
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();

    // Days since epoch
    let days = secs / 86400;

    // Simple date calculation (not perfect but good enough for manifests)
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

fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_temp_dir() -> (tempfile::TempDir, PathBuf) {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().to_path_buf();
        (temp, app_data)
    }

    #[test]
    fn test_sanitize_name() {
        assert_eq!(sanitize_name("My Instance 1"), "my_instance_1");
        assert_eq!(sanitize_name("Hello.World"), "hello_world");
        assert_eq!(sanitize_name("test"), "test");
    }

    #[test]
    fn test_create_and_read_manifest() {
        let (_temp, app_data) = setup_temp_dir();

        let input = CreateInstanceInput {
            name: "Test Instance".to_string(),
            mc_version: "1.21.8".to_string(),
            loader: "vanilla".to_string(),
            loader_version: "".to_string(),
            java_version: "21".to_string(),
            custom_java_path: None,
            ram: 4096,
            jvm_args: None,
        };

        let created = create_instance(&app_data, input).unwrap();
        assert_eq!(created.name, "Test Instance");
        assert_eq!(created.schema_version, crate::manifest::CURRENT_SCHEMA_VERSION);

        // Read it back
        let result = read_manifest(&app_data, "Test Instance").unwrap();
        assert_eq!(result.manifest.name, "Test Instance");
        assert!(!result.migrated);
    }

    #[test]
    fn test_list_instances() {
        let (_temp, app_data) = setup_temp_dir();

        let input1 = CreateInstanceInput {
            name: "Instance 1".to_string(),
            mc_version: "1.21".to_string(),
            loader: "vanilla".to_string(),
            loader_version: "".to_string(),
            java_version: "21".to_string(),
            custom_java_path: None,
            ram: 2048,
            jvm_args: None,
        };

        let input2 = CreateInstanceInput {
            name: "Instance 2".to_string(),
            mc_version: "1.20".to_string(),
            loader: "fabric".to_string(),
            loader_version: "0.15.0".to_string(),
            java_version: "17".to_string(),
            custom_java_path: None,
            ram: 4096,
            jvm_args: None,
        };

        create_instance(&app_data, input1).unwrap();
        create_instance(&app_data, input2).unwrap();

        let instances = list_instances(&app_data).unwrap();
        assert_eq!(instances.len(), 2);
    }

    #[test]
    fn test_delete_instance() {
        let (_temp, app_data) = setup_temp_dir();

        let input = CreateInstanceInput {
            name: "ToDelete".to_string(),
            mc_version: "1.21".to_string(),
            loader: "vanilla".to_string(),
            loader_version: "".to_string(),
            java_version: "21".to_string(),
            custom_java_path: None,
            ram: 2048,
            jvm_args: None,
        };

        create_instance(&app_data, input).unwrap();
        delete_instance(&app_data, "ToDelete").unwrap();

        let result = read_manifest(&app_data, "ToDelete");
        assert!(result.is_err());
    }
}
