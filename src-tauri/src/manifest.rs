use serde::{Deserialize, Serialize};
use std::fmt;

/// Current schema version for instance manifests
pub const CURRENT_SCHEMA_VERSION: u32 = 3;

/// Supported Minecraft loaders
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LoaderType {
    Vanilla,
    Fabric,
    NeoForge,
}

impl fmt::Display for LoaderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LoaderType::Vanilla => write!(f, "vanilla"),
            LoaderType::Fabric => write!(f, "fabric"),
            LoaderType::NeoForge => write!(f, "neoforge"),
        }
    }
}

impl TryFrom<&str> for LoaderType {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "vanilla" => Ok(LoaderType::Vanilla),
            "fabric" => Ok(LoaderType::Fabric),
            "neoforge" => Ok(LoaderType::NeoForge),
            _ => Err(format!("Unknown loader type: {}", value)),
        }
    }
}

/// Instance manifest - v1 schema
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceManifest {
    /// Schema version for migration support (required)
    pub schema_version: u32,
    /// Display name of the instance
    pub name: String,
    /// Minecraft version (e.g. "1.21.8")
    pub mc_version: String,
    /// Mod loader type
    pub loader: LoaderType,
    /// Mod loader version (e.g. "0.17.3")
    pub loader_version: String,
    /// Required Java version (e.g. "21")
    pub java_version: String,
    /// Custom Java path (optional, user-provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_java_path: Option<String>,
    /// Allocated RAM in MB
    pub ram: u64,
    /// JVM arguments (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jvm_args: Option<String>,
    /// Instance icon — "item:diamond" for built-in items, "url:https://..." for custom images
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Number of times this instance has been launched
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch_count: Option<u64>,
    /// ISO date of creation
    pub created_at: String,
    /// ISO date of last update
    pub updated_at: String,
}

/// Minimal data required to create a new instance (from frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInstanceInput {
    pub name: String,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: String,
    pub java_version: String,
    pub custom_java_path: Option<String>,
    pub ram: u64,
    pub jvm_args: Option<String>,
    /// Instance icon identifier
    pub icon: Option<String>,
    /// Initial launch count (defaults to 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub launch_count: Option<u64>,
}

/// Result of a manifest read operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadManifestResult {
    pub manifest: InstanceManifest,
    pub migrated: bool,
}

/// Error code for manifest operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ManifestErrorCode {
    InvalidSchema,
    ParseError,
    NotFound,
    MigrationFailed,
}

impl fmt::Display for ManifestErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ManifestErrorCode::InvalidSchema => write!(f, "INVALID_SCHEMA"),
            ManifestErrorCode::ParseError => write!(f, "PARSE_ERROR"),
            ManifestErrorCode::NotFound => write!(f, "NOT_FOUND"),
            ManifestErrorCode::MigrationFailed => write!(f, "MIGRATION_FAILED"),
        }
    }
}

/// Serializable error type for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestError {
    pub code: ManifestErrorCode,
    pub message: String,
}

impl std::error::Error for ManifestError {}

impl fmt::Display for ManifestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}
