use crate::instance_manager;
use crate::manifest::{ManifestError, ManifestErrorCode};
use std::fs::File;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::ZipWriter;

/// Export an instance to a ZIP file at the specified path.
/// The ZIP contains the full instance directory including instance.json.
pub fn export_instance(
    app_data_dir: &Path,
    instance_name: &str,
    output_path: &Path,
) -> Result<PathBuf, ManifestError> {
    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(instance_name));

    // Verify instance exists
    if !instance_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    let file = File::create(output_path).map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to create ZIP file: {}", e),
    })?;

    let mut zip = ZipWriter::new(file);
    let options = FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Walk through the instance directory and add all files
    for entry in WalkDir::new(&instance_dir).min_depth(0) {
        let entry = entry.map_err(|e| ManifestError {
            code: ManifestErrorCode::ParseError,
            message: format!("Failed to read directory entry: {}", e),
        })?;

        let path = entry.path();
        let name = path
            .strip_prefix(&instance_dir)
            .map_err(|_| ManifestError {
                code: ManifestErrorCode::ParseError,
                message: "Failed to compute relative path".to_string(),
            })?;

        // Store paths with forward slashes for cross-platform compatibility
        let zip_path = name.to_string_lossy().replace('\\', "/");

        if entry.file_type().is_dir() {
            zip.add_directory(&zip_path, options).map_err(|e| {
                ManifestError {
                    code: ManifestErrorCode::ParseError,
                    message: format!("Failed to add directory to ZIP: {}", e),
                }
            })?;
        } else {
            zip.start_file(&zip_path, options).map_err(|e| {
                ManifestError {
                    code: ManifestErrorCode::ParseError,
                    message: format!("Failed to start file in ZIP: {}", e),
                }
            })?;

            let mut f = File::open(path).map_err(|e| ManifestError {
                code: ManifestErrorCode::ParseError,
                message: format!("Failed to open file: {}", e),
            })?;

            std::io::copy(&mut f, &mut zip).map_err(|e| ManifestError {
                code: ManifestErrorCode::ParseError,
                message: format!("Failed to write file to ZIP: {}", e),
            })?;
        }
    }

    // Finalize the ZIP
    zip.finish().map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to finalize ZIP: {}", e),
    })?;

    Ok(output_path.to_path_buf())
}

/// Sanitize instance name for filesystem use (duplicated from instance_manager)
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
