use chrono::DateTime;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::sanitize::sanitize_name;

// ─── Data Structures ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CrashType {
    #[serde(rename = "JVM")]
    Jvm,
    #[serde(rename = "Minecraft")]
    Minecraft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrashReport {
    pub filename: String,
    pub file_path: String,
    pub crash_type: CrashType,
    pub timestamp: String,   // ISO 8601
    pub file_size: u64,      // bytes
    pub preview: String,     // First meaningful line (e.g. SIGSEGV or crash reason)
}

// ─── Instance directory helper ──────────────────────────────────────

fn instance_dir(app_data_dir: &Path, instance_name: &str) -> PathBuf {
    app_data_dir
        .join("instances")
        .join(sanitize_name(instance_name))
}

// ─── Public API ─────────────────────────────────────────────────────

/// List all crash reports for a given instance.
/// Scans for JVM crash logs (hs_err_pid*.log) and Minecraft crash reports
/// (crash-reports/crash-*.txt) in the instance directory.
pub fn list_crash_reports(
    app_data_dir: &Path,
    instance_name: &str,
) -> Result<Vec<CrashReport>, String> {
    let inst_dir = instance_dir(app_data_dir, instance_name);
    if !inst_dir.exists() {
        return Err(format!(
            "Instance '{}' not found at {:?}",
            instance_name, inst_dir
        ));
    }

    let mut reports: Vec<CrashReport> = Vec::new();

    // 1. Scan for JVM crash logs (hs_err_pid*.log) directly in instance dir
    if let Ok(entries) = fs::read_dir(&inst_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let filename = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                if filename.starts_with("hs_err_pid") && filename.ends_with(".log") {
                    if let Some(report) = build_report(&path, &filename, CrashType::Jvm) {
                        reports.push(report);
                    }
                }
            }
        }
    }

    // 2. Scan for Minecraft crash reports (crash-reports/crash-*.txt)
    let crash_reports_dir = inst_dir.join("crash-reports");
    if crash_reports_dir.exists() && crash_reports_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&crash_reports_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let filename = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    if filename.starts_with("crash-") && filename.ends_with(".txt") {
                        if let Some(report) = build_report(&path, &filename, CrashType::Minecraft)
                        {
                            reports.push(report);
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp descending (newest first)
    reports.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(reports)
}

/// Read the full content of a specific crash report file.
pub fn read_crash_report(
    app_data_dir: &Path,
    instance_name: &str,
    filename: &str,
) -> Result<String, String> {
    let file_path = resolve_file_path(app_data_dir, instance_name, filename)?;
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read crash report '{}': {}", filename, e))
}

/// Delete a single crash report file.
pub fn delete_crash_report(
    app_data_dir: &Path,
    instance_name: &str,
    filename: &str,
) -> Result<(), String> {
    let file_path = resolve_file_path(app_data_dir, instance_name, filename)?;
    fs::remove_file(&file_path)
        .map_err(|e| format!("Failed to delete crash report '{}': {}", filename, e))
}

/// Delete all crash reports for a given instance.
pub fn delete_all_crash_reports(
    app_data_dir: &Path,
    instance_name: &str,
) -> Result<u32, String> {
    let reports = list_crash_reports(app_data_dir, instance_name)?;
    let count = reports.len() as u32;
    for report in &reports {
        let path = PathBuf::from(&report.file_path);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete '{}': {}", report.filename, e))?;
        }
    }
    Ok(count)
}

// ─── Helpers ────────────────────────────────────────────────────────

/// Build a CrashReport struct from a file path and type.
fn build_report(path: &Path, filename: &str, crash_type: CrashType) -> Option<CrashReport> {
    let metadata = fs::metadata(path).ok()?;
    let file_size = metadata.len();

    // Get modification time as ISO 8601
    let timestamp = metadata
        .modified()
        .ok()
        .and_then(|t| {
            let duration = t
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?;
            let secs = duration.as_secs() as i64;
            let nanos = duration.subsec_nanos();
            DateTime::from_timestamp(secs, nanos)
                .map(|dt| dt.to_rfc3339())
        })
        .unwrap_or_else(|| "unknown".to_string());

    // Extract preview: first meaningful line after comments
    let preview = extract_preview(path, &crash_type);

    Some(CrashReport {
        filename: filename.to_string(),
        file_path: path.to_string_lossy().to_string(),
        crash_type,
        timestamp,
        file_size,
        preview,
    })
}

/// Extract a short preview from the crash report.
/// For JVM: look for SIGSEGV/SIGABRT or first # line with error description.
/// For Minecraft: look for the first line with "----" or the crash reason.
fn extract_preview(path: &Path, crash_type: &CrashType) -> String {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    match crash_type {
        CrashType::Jvm => {
            // Look for the error line like "#  EXCEPTION_ACCESS_VIOLATION..."
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("#") && !trimmed.starts_with("##")
                    && (trimmed.contains("EXCEPTION")
                        || trimmed.contains("SIGSEGV")
                        || trimmed.contains("SIGABRT")
                        || trimmed.contains("fatal")
                        || trimmed.contains("error"))
                {
                    return trimmed.trim_start_matches("# ").to_string();
                }
                // Fallback: first non-empty, non-comment line
                if !trimmed.is_empty()
                    && !trimmed.starts_with('#')
                    && !trimmed.starts_with("//")
                    && !trimmed.starts_with("/*")
                {
                    return trimmed.to_string();
                }
            }
            // Last resort: first non-empty line
            for line in content.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    return trimmed.trim_start_matches("# ").to_string();
                }
            }
            "JVM crash".to_string()
        }
        CrashType::Minecraft => {
            // Look for "---- Minecraft Crash Report ----" or the description
            let mut found_header = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.contains("Minecraft Crash Report") {
                    found_header = true;
                    continue;
                }
                if found_header && !trimmed.is_empty() {
                    return trimmed.to_string();
                }
                // Also look for "Description:" or "java.lang."
                if trimmed.starts_with("Description:") {
                    if let Some(desc) = trimmed.strip_prefix("Description:") {
                        return desc.trim().to_string();
                    }
                }
                if trimmed.starts_with("java.lang.") || trimmed.starts_with("net.minecraft.") {
                    return trimmed.to_string();
                }
            }
            "Minecraft crash".to_string()
        }
    }
}

/// Resolve the full path of a crash report file, checking both
/// instance root (for JVM) and crash-reports/ subdirectory (for Minecraft).
fn resolve_file_path(
    app_data_dir: &Path,
    instance_name: &str,
    filename: &str,
) -> Result<PathBuf, String> {
    let inst_dir = instance_dir(app_data_dir, instance_name);
    if !inst_dir.exists() {
        return Err(format!("Instance '{}' not found", instance_name));
    }

    // Check instance root (JVM hs_err logs)
    let direct_path = inst_dir.join(filename);
    if direct_path.exists() && direct_path.is_file() {
        return Ok(direct_path);
    }

    // Check crash-reports/ subdirectory (Minecraft crash reports)
    let crash_reports_path = inst_dir.join("crash-reports").join(filename);
    if crash_reports_path.exists() && crash_reports_path.is_file() {
        return Ok(crash_reports_path);
    }

    Err(format!(
        "Crash report '{}' not found for instance '{}'",
        filename, instance_name
    ))
}
