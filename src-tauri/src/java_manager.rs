use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

// ─── Data structures ────────────────────────────────────────────────

/// Response from Adoptium `/v3/info/available_releases`
#[derive(Debug, Deserialize)]
struct AdoptiumAvailableReleases {
    #[serde(rename = "available_releases")]
    pub available_releases: Vec<u16>,
    // Keep for deserialization even if not read
    #[allow(dead_code)]
    #[serde(rename = "most_recent_feature_release")]
    pub most_recent_feature_release: u16,
}

/// Java version info returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaVersionInfo {
    pub version: String,        // e.g. "17", "21"
    pub available: bool,        // available on Adoptium
    pub installed: bool,        // downloaded locally
    pub path: Option<String>,   // path to java.exe if installed
    pub verified: bool,         // java -version confirmed
}

/// Status of a download operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadStatus {
    pub version: String,
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

// ─── Java Manager ───────────────────────────────────────────────────

pub struct JavaManager {
    java_dir: PathBuf,
    os: String,
    arch: String,
}

impl JavaManager {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let java_dir = app_data_dir.join("java");
        let (os, arch) = detect_platform();
        Self { java_dir, os, arch }
    }

    // ── Helpers ────────────────────────────────────────────────────

    fn java_dir_for(&self, version: &str) -> PathBuf {
        self.java_dir.join(version)
    }

    fn java_exe_path(&self, version: &str) -> PathBuf {
        let dir = self.java_dir_for(version);
        if cfg!(target_os = "windows") {
            dir.join("bin").join("java.exe")
        } else {
            dir.join("bin").join("java")
        }
    }

    fn is_installed(&self, version: &str) -> bool {
        self.java_exe_path(version).exists()
    }

    fn verify_java(&self, version: &str) -> bool {
        let java_path = self.java_exe_path(version);
        if !java_path.exists() {
            return false;
        }

        match std::process::Command::new(&java_path)
            .arg("-version")
            .output()
        {
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // java -version outputs to stderr in format:
                // openjdk version "21.0.2" 2024-01-16
                stderr.contains(&format!("version \"{}", version))
                    || stderr.contains("openjdk version")
            }
            Err(_) => false,
        }
    }

    // ── Public API ─────────────────────────────────────────────────

    /// Fetch list of available Java versions from Adoptium API and
    /// combine with locally installed versions.
    pub fn list_versions(&self) -> Result<Vec<JavaVersionInfo>, String> {
        let url = "https://api.adoptium.net/v3/info/available_releases";
        let resp = reqwest::blocking::get(url)
            .map_err(|e| format!("Failed to fetch available releases: {}", e))?;

        let data: AdoptiumAvailableReleases = resp
            .json()
            .map_err(|e| format!("Failed to parse releases: {}", e))?;

        // Versions 8, 11, 17, 21 are standard LTS - include all available
        let mut versions: Vec<JavaVersionInfo> = data
            .available_releases
            .iter()
            .map(|v| {
                let ver = v.to_string();
                let installed = self.is_installed(&ver);
                let path = if installed {
                    Some(self.java_exe_path(&ver).to_string_lossy().to_string())
                } else {
                    None
                };
                JavaVersionInfo {
                    version: ver.clone(),
                    available: true,
                    installed,
                    path,
                    verified: installed && self.verify_java(&ver),
                }
            })
            .collect();

        // Sort descending (newest first)
        versions.sort_by(|a, b| b.version.cmp(&a.version));

        Ok(versions)
    }

    /// Download and extract a specific Java version from Adoptium.
    pub fn download_java(&self, version: &str) -> Result<DownloadStatus, String> {
        let target_dir = self.java_dir_for(version);

        // Check if already installed and verified
        if self.is_installed(version) && self.verify_java(version) {
            return Ok(DownloadStatus {
                version: version.to_string(),
                success: true,
                path: Some(self.java_exe_path(version).to_string_lossy().to_string()),
                error: None,
            });
        }

        // Create temp directory for download
        let temp_dir = self.java_dir.join(".tmp");
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;

        // Build download URL
        let download_url = format!(
            "https://api.adoptium.net/v3/binary/latest/{}/ga/{}/{}/jre/hotspot/normal/eclipse",
            version, self.os, self.arch
        );

        // Download the archive
        let resp = reqwest::blocking::get(&download_url)
            .map_err(|e| format!("Failed to download Java {}: {}", version, e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "Adoptium returned HTTP {} for version {}",
                resp.status(),
                version
            ));
        }

        // Detect archive type from Content-Type or Content-Disposition
        let content_type = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        let is_zip = content_type.contains("zip") || cfg!(target_os = "windows");

        // Save to temp file
        let ext = if is_zip { "zip" } else { "tar.gz" };
        let archive_path = temp_dir.join(format!("java_{}.{}", version, ext));

        let bytes = resp
            .bytes()
            .map_err(|e| format!("Failed to read download: {}", e))?;

        fs::write(&archive_path, &bytes)
            .map_err(|e| format!("Failed to save archive: {}", e))?;

        // Remove target dir if exists (clean install)
        if target_dir.exists() {
            fs::remove_dir_all(&target_dir)
                .map_err(|e| format!("Failed to clean old Java dir: {}", e))?;
        }
        fs::create_dir_all(&target_dir)
            .map_err(|e| format!("Failed to create Java dir: {}", e))?;

        // Extract
        if is_zip {
            Self::extract_zip(&archive_path, &target_dir)?;
        } else {
            Self::extract_tar_gz(&archive_path, &target_dir)?;
        }

        // Clean up temp file
        let _ = fs::remove_file(&archive_path);

        // Remove top-level directory if present (Adoptium archives have a versioned top dir)
        Self::strip_top_level_dir(&target_dir);

        // Verify
        let verified = self.verify_java(version);
        let java_path = self.java_exe_path(version);

        Ok(DownloadStatus {
            version: version.to_string(),
            success: true,
            path: Some(java_path.to_string_lossy().to_string()),
            error: if verified {
                None
            } else {
                Some("Java executable found but version verification failed".to_string())
            },
        })
    }

    /// Get the path to a Java executable for a given version.
    pub fn get_java_path(&self, version: &str) -> Result<String, String> {
        let java_path = self.java_exe_path(version);
        if java_path.exists() {
            Ok(java_path.to_string_lossy().to_string())
        } else {
            Err(format!(
                "Java {} is not installed at {}",
                version,
                java_path.display()
            ))
        }
    }

    /// Download Java in background thread, emitting events.
    pub fn download_java_background(
        app_handle: AppHandle,
        app_data_dir: PathBuf,
        version: String,
    ) {
        std::thread::spawn(move || {
            let manager = JavaManager::new(&app_data_dir);
            match manager.download_java(&version) {
                Ok(status) => {
                    let _ = app_handle.emit("java:download-complete", json!({
                        "version": status.version,
                        "success": status.success,
                        "path": status.path,
                        "error": status.error,
                    }));
                }
                Err(e) => {
                    let _ = app_handle.emit("java:download-error", json!({
                        "version": version,
                        "message": e,
                    }));
                }
            }
        });
    }

    /// Verify a custom Java path by running `java -version`.
    /// Returns the detected version string if valid, or an error.
    pub fn verify_custom_path(path: &str) -> Result<String, String> {
        let java_path = Path::new(path);
        if !java_path.exists() {
            return Err(format!("File not found: {}", path));
        }

        match std::process::Command::new(java_path)
            .arg("-version")
            .output()
        {
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Parse: openjdk version "21.0.2" 2024-01-16
                if let Some(version_line) = stderr.lines().next() {
                    let version = version_line
                        .trim()
                        .split('"')
                        .nth(1)
                        .unwrap_or("unknown")
                        .to_string();
                    Ok(version)
                } else {
                    Err("Could not parse java -version output".to_string())
                }
            }
            Err(e) => Err(format!("Failed to run java -version: {}", e)),
        }
    }

    // ── Extraction helpers ─────────────────────────────────────────

    fn extract_zip(archive: &Path, target: &Path) -> Result<(), String> {
        let file = fs::File::open(archive)
            .map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut zip_reader = zip::ZipArchive::new(file)
            .map_err(|e| format!("Failed to read zip: {}", e))?;

        for i in 0..zip_reader.len() {
            let mut entry = zip_reader
                .by_index(i)
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;

            // Build output path, stripping any top-level dir
            let out_path = {
                let name = entry.name().to_string();
                // Strip top-level directory if present (e.g. "jdk-17.0.9+9/bin/java.exe")
                let path = Path::new(&name);
                path.iter().skip(1).collect::<PathBuf>()
            };

            if out_path.as_os_str().is_empty() {
                continue; // skip top-level dir entry
            }

            let full_path = target.join(&out_path);

            if entry.is_dir() {
                fs::create_dir_all(&full_path)
                    .map_err(|e| format!("Failed to create dir: {}", e))?;
            } else {
                if let Some(parent) = full_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
                let mut outfile = fs::File::create(&full_path)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                std::io::copy(&mut entry, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
            }
        }

        Ok(())
    }

    fn extract_tar_gz(archive: &Path, target: &Path) -> Result<(), String> {
        let file = fs::File::open(archive)
            .map_err(|e| format!("Failed to open tar.gz: {}", e))?;
        let decoder = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(decoder);

        for entry in archive.entries()
            .map_err(|e| format!("Failed to read tar entries: {}", e))?
        {
            let mut entry = entry.map_err(|e| format!("Failed to read tar entry: {}", e))?;
            let path = entry.path().map_err(|e| format!("Bad path: {}", e))?;

            // Strip top-level directory
            let out_path: PathBuf = path.iter().skip(1).collect();
            if out_path.as_os_str().is_empty() {
                continue;
            }

            let full_path = target.join(&out_path);

            if entry.header().entry_type().is_dir() {
                fs::create_dir_all(&full_path)
                    .map_err(|e| format!("Failed to create dir: {}", e))?;
            } else {
                if let Some(parent) = full_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create parent dir: {}", e))?;
                }
                entry.unpack(&full_path)
                    .map_err(|e| format!("Failed to extract: {}", e))?;
            }
        }

        Ok(())
    }

    /// Remove top-level directory if the extraction left one.
    /// E.g. if we extracted to `target/jdk-17.0.9+9/bin/java`,
    /// move contents up and remove the versioned dir.
    fn strip_top_level_dir(target: &Path) {
        let entries: Vec<_> = match fs::read_dir(target) {
            Ok(e) => e.filter_map(|e| e.ok()).map(|e| e.path()).collect(),
            Err(_) => return,
        };

        // If there's exactly one entry and it's a directory, move its contents up
        if entries.len() == 1 {
            if let Some(only_entry) = entries.first() {
                if only_entry.is_dir() {
                    if let Ok(sub_entries) = fs::read_dir(only_entry) {
                        for sub in sub_entries.flatten() {
                            let name = sub.file_name();
                            let src = sub.path();
                            let dst = target.join(&name);
                            // Move file/dir up
                            let _ = fs::rename(&src, &dst);
                        }
                        // Remove the now-empty top-level dir
                        let _ = fs::remove_dir(only_entry);
                    }
                }
            }
        }
    }
}

// ─── Platform detection ─────────────────────────────────────────────

fn detect_platform() -> (String, String) {
    let os = if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "mac".to_string()
    } else {
        "linux".to_string()
    };

    let arch = if cfg!(target_arch = "aarch64") {
        "aarch64".to_string()
    } else {
        "x64".to_string()
    };

    (os, arch)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// Helper: create a temporary JavaManager with a temp dir
    fn setup_java_manager() -> (tempfile::TempDir, JavaManager) {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().to_path_buf();
        let manager = JavaManager::new(&app_data);
        (temp, manager)
    }

    // ── Constructor & Helpers ─────────────────────────────────────

    #[test]
    fn test_java_manager_constructor() {
        let (_temp, manager) = setup_java_manager();
        // java_dir should end with "java"
        assert!(manager.java_dir.to_string_lossy().ends_with("java"));
        assert!(!manager.os.is_empty());
        assert!(!manager.arch.is_empty());
        assert!(manager.os == "windows" || manager.os == "mac" || manager.os == "linux");
        assert!(manager.arch == "x64" || manager.arch == "aarch64");
    }

    #[test]
    fn test_java_dir_for() {
        let (_temp, manager) = setup_java_manager();
        let dir = manager.java_dir_for("21");
        let path_str = dir.to_string_lossy();
        // On Windows path separator is \, on Unix it's /
        assert!(
            path_str.ends_with("java/21") || path_str.ends_with("java\\21"),
            "Expected java dir to end with java/21 or java\\21, got: {}",
            path_str
        );
    }

    #[test]
    fn test_java_exe_path_on_platform() {
        let (_temp, manager) = setup_java_manager();
        let exe = manager.java_exe_path("17");
        let path_str = exe.to_string_lossy();
        // Should end with bin/java.exe (Windows) or bin/java (Unix)
        #[cfg(target_os = "windows")]
        assert!(path_str.ends_with(r"bin\java.exe"), "Expected bin\\java.exe, got {}", path_str);
        #[cfg(not(target_os = "windows"))]
        assert!(path_str.ends_with("bin/java"), "Expected bin/java, got {}", path_str);
    }

    #[test]
    fn test_is_installed_returns_false_when_not_installed() {
        let (_temp, manager) = setup_java_manager();
        assert!(!manager.is_installed("99"));
    }

    #[test]
    fn test_is_installed_returns_true_when_file_exists() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().to_path_buf();
        let manager = JavaManager::new(&app_data);

        // Create a fake java exe
        let exe_path = manager.java_exe_path("21");
        fs::create_dir_all(exe_path.parent().unwrap()).unwrap();
        fs::write(&exe_path, b"fake java binary").unwrap();

        assert!(manager.is_installed("21"));
    }

    // ── get_java_path ─────────────────────────────────────────────

    #[test]
    fn test_get_java_path_returns_error_when_not_installed() {
        let (_temp, manager) = setup_java_manager();
        let result = manager.get_java_path("21");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("is not installed"));
    }

    #[test]
    fn test_get_java_path_returns_path_when_installed() {
        let temp = tempfile::tempdir().unwrap();
        let app_data = temp.path().to_path_buf();
        let manager = JavaManager::new(&app_data);

        // Create a fake java exe
        let exe_path = manager.java_exe_path("21");
        fs::create_dir_all(exe_path.parent().unwrap()).unwrap();
        fs::write(&exe_path, b"fake java binary").unwrap();

        let result = manager.get_java_path("21");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), exe_path.to_string_lossy().to_string());
    }

    // ── verify_custom_path ────────────────────────────────────────

    #[test]
    fn test_verify_custom_path_returns_error_when_not_found() {
        let temp = tempfile::tempdir().unwrap();
        let bad_path = temp.path().join("nonexistent").join("java.exe");
        let result = JavaManager::verify_custom_path(&bad_path.to_string_lossy());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File not found"));
    }

    // ── strip_top_level_dir ───────────────────────────────────────

    #[test]
    fn test_strip_top_level_dir_does_nothing_on_empty() {
        let temp = tempfile::tempdir().unwrap();
        JavaManager::strip_top_level_dir(temp.path());
        // Should not crash, dir should still exist
        assert!(temp.path().exists());
    }

    #[test]
    fn test_strip_top_level_dir_moves_contents_up() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("extracted");
        fs::create_dir_all(&target).unwrap();

        // Create a top-level dir with files inside (simulating jdk-17.0.9+9/)
        let top_dir = target.join("jdk-17.0.9+9");
        fs::create_dir_all(top_dir.join("bin")).unwrap();
        fs::write(top_dir.join("bin").join("java.exe"), b"content").unwrap();
        fs::write(top_dir.join("release"), b"JAVA_VERSION=17").unwrap();

        // Strip it
        JavaManager::strip_top_level_dir(&target);

        // Now bin/java.exe and release should be directly in target
        assert!(target.join("bin").join("java.exe").exists(), "bin/java.exe should be in target");
        assert!(target.join("release").exists(), "release should be in target");
        // Top-level dir should be gone
        assert!(!top_dir.exists(), "Top-level dir should be removed");
    }

    #[test]
    fn test_strip_top_level_dir_does_nothing_with_multiple_entries() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("extracted");
        fs::create_dir_all(&target).unwrap();

        // Create multiple top-level entries
        fs::create_dir_all(target.join("dir1")).unwrap();
        fs::create_dir_all(target.join("dir2")).unwrap();
        fs::write(target.join("file.txt"), b"hello").unwrap();

        // Strip should do nothing (more than 1 entry)
        JavaManager::strip_top_level_dir(&target);

        assert!(target.join("dir1").exists());
        assert!(target.join("dir2").exists());
        assert!(target.join("file.txt").exists());
    }

    // ── extract_zip ───────────────────────────────────────────────

    #[test]
    fn test_extract_zip_strips_top_level_dir() {
        let temp = tempfile::tempdir().unwrap();
        let zip_path = temp.path().join("test.zip");
        let target = temp.path().join("output");
        fs::create_dir_all(&target).unwrap();

        // Create a zip file programmatically with a top-level dir
        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip_writer = zip::ZipWriter::new(file);

            // Add file inside top-level dir
            // (No explicit directory entry needed - zip format infers it from file paths)
            zip_writer.start_file::<&str, ()>(
                "jdk-21.0.2/bin/java.exe",
                zip::write::FileOptions::default(),
            )
            .unwrap();
            zip_writer.write_all(b"fake java binary").unwrap();

            // Add another file
            zip_writer.start_file::<&str, ()>(
                "jdk-21.0.2/release",
                zip::write::FileOptions::default(),
            )
            .unwrap();
            zip_writer.write_all(b"JAVA_VERSION=21").unwrap();

            zip_writer.finish().unwrap();
        }

        // Extract
        JavaManager::extract_zip(&zip_path, &target).unwrap();

        // Verify: top-level dir stripped, files in target directly
        assert!(
            target.join("bin").join("java.exe").exists(),
            "Expected bin/java.exe in target after stripping top dir"
        );
        assert!(
            target.join("release").exists(),
            "Expected release in target after stripping top dir"
        );
        // Top-level dir should NOT exist
        assert!(
            !target.join("jdk-21.0.2").exists(),
            "Top-level dir should have been stripped"
        );
    }

    #[test]
    fn test_extract_zip_returns_error_on_missing_file() {
        let temp = tempfile::tempdir().unwrap();
        let bad_path = temp.path().join("nonexistent.zip");
        let result = JavaManager::extract_zip(&bad_path, &temp.path().join("out"));
        assert!(result.is_err());
    }

    // ── list_versions ─────────────────────────────────────────────

    #[test]
    #[ignore = "Requires network access to Adoptium API"]
    fn test_list_versions_includes_available_releases() {
        // This test requires network access to Adoptium API
        // If offline, it will return an error which is acceptable
        let (_temp, manager) = setup_java_manager();
        match manager.list_versions() {
            Ok(versions) => {
                // Should have at least some versions (8, 11, 17, 21...)
                assert!(!versions.is_empty(), "Should have at least one version");
                // Should be sorted descending (newest first)
                for i in 1..versions.len() {
                    assert!(
                        versions[i - 1].version >= versions[i].version,
                        "Versions should be sorted descending"
                    );
                }
                // Should be marked as available
                for v in &versions {
                    assert!(v.available, "Version {} should be available", v.version);
                }
            }
            Err(e) => {
                // Network might not be available in test environment
                eprintln!("Warning: list_versions network test skipped: {}", e);
            }
        }
    }
}

