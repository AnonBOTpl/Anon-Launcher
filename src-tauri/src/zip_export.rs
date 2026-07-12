use crate::instance_manager;
use crate::manifest::{ManifestError, ManifestErrorCode};
use crate::sanitize::sanitize_name;
use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::ZipWriter;

/// Count total files in an instance directory (for progress tracking).
pub fn count_files(app_data_dir: &Path, instance_name: &str) -> Result<usize, ManifestError> {
    let instances_dir = instance_manager::get_instances_dir(app_data_dir);
    let instance_dir = instances_dir.join(sanitize_name(instance_name));

    if !instance_dir.exists() {
        return Err(ManifestError {
            code: ManifestErrorCode::NotFound,
            message: format!("Instance '{}' not found", instance_name),
        });
    }

    let count = WalkDir::new(&instance_dir)
        .min_depth(0)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .count();

    Ok(count)
}

/// Progress event emitted during export
#[derive(Clone, serde::Serialize)]
pub struct ExportProgressEvent {
    pub current: usize,
    pub total: usize,
    pub file_name: String,
    pub phase: String,
}

/// Result event emitted when export is complete
#[derive(Clone, serde::Serialize)]
pub struct ExportCompleteEvent {
    pub path: String,
}

/// Error event emitted when export fails
#[derive(Clone, serde::Serialize)]
pub struct ExportErrorEvent {
    pub message: String,
}

/// Run the export in a background thread, emitting progress events via the AppHandle.
/// Returns immediately — the frontend listens for export:progress, export:complete, export:error events.
/// `total_files` is pre-counted to avoid walking the directory twice.
pub fn export_instance_background(
    app_handle: tauri::AppHandle,
    app_data_dir: PathBuf,
    instance_name: String,
    output_path: PathBuf,
    total_files: usize,
) {
    std::thread::spawn(move || {
        let result = do_export(
            &app_handle,
            &app_data_dir,
            &instance_name,
            &output_path,
            total_files,
        );

        match result {
            Ok(path) => {
                let _ = app_handle.emit("export:complete", ExportCompleteEvent {
                    path: path.to_string_lossy().to_string(),
                });
            }
            Err(err) => {
                let _ = app_handle.emit("export:error", ExportErrorEvent {
                    message: err.message,
                });
            }
        }
    });
}

/// The actual export work — walks files and compresses them into a ZIP.
/// `total_files` is pre-counted by the command handler to avoid double directory walk.
fn do_export(
    app_handle: &tauri::AppHandle,
    app_data_dir: &Path,
    instance_name: &str,
    output_path: &Path,
    total_files: usize,
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

    let mut processed = 0usize;

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

            processed += 1;

            // Emit progress every file
            let file_name = name.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let _ = app_handle.emit("export:progress", ExportProgressEvent {
                current: processed,
                total: total_files,
                file_name,
                phase: "compressing".to_string(),
            });
        }
    }

    // Finalize the ZIP
    zip.finish().map_err(|e| ManifestError {
        code: ManifestErrorCode::ParseError,
        message: format!("Failed to finalize ZIP: {}", e),
    })?;

    // Emit done
    let _ = app_handle.emit("export:progress", ExportProgressEvent {
        current: total_files,
        total: total_files,
        file_name: String::new(),
        phase: "done".to_string(),
    });

    Ok(output_path.to_path_buf())
}


