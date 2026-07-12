use crate::manifest::{InstanceManifest, ManifestError, ManifestErrorCode, CURRENT_SCHEMA_VERSION};
use serde_json::Value;

/// Check if raw JSON data has a valid schemaVersion field
pub fn has_schema_version(data: &Value) -> bool {
    data.get("schemaVersion")
        .and_then(|v| v.as_u64())
        .map_or(false, |sv| sv >= 1)
}

/// Migrate manifest data from any older schema version to the current version.
/// Returns the migrated manifest or a ManifestError.
pub fn migrate_manifest(data: Value) -> Result<(InstanceManifest, bool), ManifestError> {
    if !has_schema_version(&data) {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: "Manifest is missing required 'schemaVersion' field".to_string(),
        });
    }

    let current_sv = data
        .get("schemaVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    if current_sv > CURRENT_SCHEMA_VERSION {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: format!(
                "Manifest schema version {} is newer than current version {}",
                current_sv, CURRENT_SCHEMA_VERSION
            ),
        });
    }

    let mut migrated = false;
    let mut current_data = data;

    // Apply sequential migrations from current version to latest
    // Each migration transforms the JSON value from version N to N+1
    let mut sv = current_sv;
    while sv < CURRENT_SCHEMA_VERSION {
        current_data = apply_migration(sv, current_data)?;
        sv += 1;
        migrated = true;
    }

    // Deserialize the migrated data
    let manifest: InstanceManifest = serde_json::from_value(current_data).map_err(|e| {
        ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to parse manifest after migration: {}", e),
        }
    })?;

    Ok((manifest, migrated))
}

/// Apply a single migration step from version N to N+1
fn apply_migration(from_version: u32, data: Value) -> Result<Value, ManifestError> {
    match from_version {
        1 => migrate_v1_to_v2(data),
        2 => migrate_v2_to_v3(data),
        _ => Err(ManifestError {
            code: ManifestErrorCode::MigrationFailed,
            message: format!(
                "No migration path from schema version {} to {}",
                from_version,
                from_version + 1
            ),
        }),
    }
}

/// Migrate from v2 to v3: add `launchCount` field (0 by default)
fn migrate_v2_to_v3(mut data: Value) -> Result<Value, ManifestError> {
    // Add launchCount field if missing
    if data.get("launchCount").is_none() {
        data["launchCount"] = serde_json::json!(0);
    }

    // Update schema version
    data["schemaVersion"] = serde_json::json!(3);

    Ok(data)
}

/// Migrate from v1 to v2: add `icon` field (null by default)
fn migrate_v1_to_v2(mut data: Value) -> Result<Value, ManifestError> {
    // Add icon field if missing
    if data.get("icon").is_none() && data.get("iconUrl").is_none() {
        data["icon"] = Value::Null;
    }

    // Update schema version
    data["schemaVersion"] = serde_json::json!(2);

    Ok(data)
}

/// Validate that a manifest has all required fields
pub fn validate_manifest(manifest: &InstanceManifest) -> Result<(), ManifestError> {
    if manifest.name.trim().is_empty() {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: "Manifest name cannot be empty".to_string(),
        });
    }

    if manifest.mc_version.trim().is_empty() {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: "Minecraft version cannot be empty".to_string(),
        });
    }

    if manifest.ram < 512 {
        return Err(ManifestError {
            code: ManifestErrorCode::InvalidSchema,
            message: "RAM must be at least 512 MB".to_string(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_has_schema_version_valid() {
        let data = json!({ "schemaVersion": 1 });
        assert!(has_schema_version(&data));
    }

    #[test]
    fn test_has_schema_version_missing() {
        let data = json!({ "name": "test" });
        assert!(!has_schema_version(&data));
    }

    #[test]
    fn test_migrate_manifest_current_version() {
        let data = json!({
            "schemaVersion": 1,
            "name": "Test Instance",
            "mcVersion": "1.21.8",
            "loader": "vanilla",
            "loaderVersion": "",
            "javaVersion": "21",
            "ram": 4096,
            "createdAt": "2026-06-28",
            "updatedAt": "2026-06-28"
        });

        let result = migrate_manifest(data);
        assert!(result.is_ok());
        let (manifest, migrated) = result.unwrap();
        assert!(!migrated);
        assert_eq!(manifest.name, "Test Instance");
        assert_eq!(manifest.schema_version, CURRENT_SCHEMA_VERSION);
    }

    #[test]
    fn test_migrate_manifest_missing_schema_version() {
        let data = json!({ "name": "test" });
        let result = migrate_manifest(data);
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err().code,
            ManifestErrorCode::InvalidSchema
        ));
    }
}
