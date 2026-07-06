use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

// ─── Data structures ────────────────────────────────────────────────

/// A single library to download
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryToDownload {
    pub path: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
}

/// A native library that needs to be extracted
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeToExtract {
    /// Path to the JAR file (relative to libraries dir)
    pub jar_path: String,
}

/// Asset index for downloading assets
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetIndexToDownload {
    pub id: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
}

/// Result of a launch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub success: bool,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

/// Progress event emitted during download phases
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    /// Phase: "client" | "libraries" | "natives"
    pub phase: String,
    /// Current progress within this phase
    pub current: usize,
    /// Total items in this phase
    pub total: usize,
    /// Human-readable status message
    pub status: String,
}

// ─── Minecraft Core ─────────────────────────────────────────────────

pub struct MinecraftCore {
    libraries_dir: PathBuf,
    assets_dir: PathBuf,
    versions_dir: PathBuf,
}

impl MinecraftCore {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        Self {
            libraries_dir: app_data_dir.join("libraries"),
            assets_dir: app_data_dir.join("assets"),
            versions_dir: app_data_dir.join("versions"),
        }
    }

    /// Emit a download progress event via Tauri
    fn emit_progress(&self, app_handle: &AppHandle, event: DownloadProgressEvent) {
        let _ = app_handle.emit("download:progress", event);
    }

    // ── Library Downloads ──────────────────────────────────────────

    /// Download a single library file.
    /// Creates parent directories as needed. Skips if file exists and checksum matches.
    fn download_library(&self, lib: &LibraryToDownload) -> Result<(), String> {
        let target_path = self.libraries_dir.join(&lib.path);

        // Skip if exists and size matches
        if target_path.exists() {
            if let Ok(metadata) = fs::metadata(&target_path) {
                if metadata.len() == lib.size {
                    return Ok(());
                }
            }
        }

        // Create parent directories
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create library dir: {}", e))?;
        }

        // Download
        let resp = reqwest::blocking::get(&lib.url)
            .map_err(|e| format!("Failed to download library {}: {}", lib.path, e))?;

        if !resp.status().is_success() {
            return Err(format!(
                "HTTP {} downloading library {}",
                resp.status(),
                lib.path
            ));
        }

        let bytes = resp
            .bytes()
            .map_err(|e| format!("Failed to read library bytes: {}", e))?;

        fs::write(&target_path, &bytes)
            .map_err(|e| format!("Failed to write library file: {}", e))?;

        Ok(())
    }

    /// Download a batch of libraries with progress events.
    /// Returns a list of downloaded file paths.
    pub fn download_libraries(
        &self,
        app_handle: &AppHandle,
        libraries: Vec<LibraryToDownload>,
    ) -> Result<Vec<String>, String> {
        let total = libraries.len();
        let mut downloaded = Vec::new();

        for (i, lib) in libraries.iter().enumerate() {
            // Emit progress before each download
            self.emit_progress(app_handle, DownloadProgressEvent {
                phase: "libraries".to_string(),
                current: i,
                total,
                status: format!("Pobieranie bibliotek ({}/{})...", i, total),
            });

            self.download_library(lib)?;
            downloaded.push(self.libraries_dir.join(&lib.path).to_string_lossy().to_string());
        }

        // Emit completion
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "libraries".to_string(),
            current: total,
            total,
            status: format!("Pobieranie bibliotek ({}/{}) — gotowe", total, total),
        });

        Ok(downloaded)
    }

    // ── Asset Downloads ────────────────────────────────────────────

    /// Download assets for a given asset index.
    /// Assets are stored as: $ASSETS_DIR/objects/{first2}/{full_hash}
    pub fn download_assets(
        &self,
        app_handle: &AppHandle,
        index: &AssetIndexToDownload,
    ) -> Result<u64, String> {
        // Download asset index
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "assets".to_string(),
            current: 0,
            total: 1,
            status: "Pobieranie indeksu assetów...".to_string(),
        });

        let resp = reqwest::blocking::get(&index.url)
            .map_err(|e| format!("Failed to download asset index: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} downloading asset index", resp.status()));
        }

        let index_bytes = resp
            .bytes()
            .map_err(|e| format!("Failed to read asset index: {}", e))?;

        // Parse asset index JSON
        let index_json: serde_json::Value = serde_json::from_slice(&index_bytes)
            .map_err(|e| format!("Failed to parse asset index: {}", e))?;

        let objects = index_json
            .get("objects")
            .and_then(|v| v.as_object())
            .ok_or_else(|| "Invalid asset index: missing 'objects'".to_string())?;

        let total_assets = objects.len();
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "assets".to_string(),
            current: 0,
            total: total_assets,
            status: format!("Sprawdzanie {} assetów...", total_assets),
        });

        // Save asset index to disk (cached)
        let objects_dir = self.assets_dir.join("objects");
        let indexes_dir = self.assets_dir.join("indexes");
        fs::create_dir_all(&objects_dir)
            .map_err(|e| format!("Failed to create objects dir: {}", e))?;
        fs::create_dir_all(&indexes_dir)
            .map_err(|e| format!("Failed to create indexes dir: {}", e))?;

        let index_path = indexes_dir.join(format!("{}.json", index.id));
        fs::write(&index_path, &index_bytes)
            .map_err(|e| format!("Failed to save asset index: {}", e))?;

        // Collect assets that need downloading (skip existing ones)
        let mut to_download: Vec<String> = Vec::new();
        for (_, asset_info) in objects.iter() {
            if let Some(hash) = asset_info.get("hash").and_then(|v| v.as_str()) {
                let prefix = &hash[..2];
                let asset_path = objects_dir.join(prefix).join(hash);
                if !asset_path.exists() {
                    to_download.push(hash.to_string());
                }
            }
        }

        let need_to_download = to_download.len();
        let already_have = total_assets - need_to_download;

        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "assets".to_string(),
            current: already_have,
            total: total_assets,
            status: format!(
                "Assetów: {} już jest, {} do pobrania",
                already_have, need_to_download
            ),
        });

        if need_to_download == 0 {
            self.emit_progress(app_handle, DownloadProgressEvent {
                phase: "assets".to_string(),
                current: total_assets,
                total: total_assets,
                status: format!("Pobieranie assetów — wszystkie już są ({})", total_assets),
            });
            return Ok(total_assets as u64);
        }

        // Download assets in parallel using threads (8 concurrent)
        let chunk_size = (need_to_download + 7) / 8; // ceil division, 8 threads
        let completed = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(already_have as u64));
        let total = total_assets;

        // Chunk the hashes for parallel download
        let chunks: Vec<Vec<String>> = to_download.chunks(chunk_size).map(|c| c.to_vec()).collect();

        std::thread::scope(|scope| {
            for chunk in &chunks {
                let chunk = chunk.clone();
                let objects_dir = objects_dir.clone();
                let completed = completed.clone();
                scope.spawn(move || {
                    for hash in chunk {
                        let prefix = &hash[..2];
                        let asset_path = objects_dir.join(prefix).join(&hash);

                        // Skip if already exists
                        if asset_path.exists() {
                            completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            continue;
                        }

                        let asset_url = format!(
                            "https://resources.download.minecraft.net/{}/{}",
                            prefix, hash
                        );

                        if let Ok(resp) = reqwest::blocking::get(&asset_url) {
                            if resp.status().is_success() {
                                if let Ok(bytes) = resp.bytes() {
                                    if let Some(parent) = asset_path.parent() {
                                        let _ = fs::create_dir_all(parent);
                                    }
                                    let _ = fs::write(&asset_path, &bytes);
                                }
                            }
                        }
                        completed.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                });
            }
        });

        let final_count = completed.load(std::sync::atomic::Ordering::Relaxed);

        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "assets".to_string(),
            current: total,
            total,
            status: format!("Pobieranie assetów — gotowe ({} assetów)", final_count),
        });

        Ok(final_count)
    }

    // ── Launch ─────────────────────────────────────────────────────

    /// Launch Minecraft with the given Java path and arguments.
    /// Returns the process PID on success.
    pub fn launch_minecraft(
        &self,
        java_path: &str,
        args: Vec<String>,
        game_dir: &str,
        detached: bool,
    ) -> Result<LaunchResult, String> {
        // Ensure game directory exists
        fs::create_dir_all(game_dir)
            .map_err(|e| format!("Failed to create game dir: {}", e))?;

        // Build the command
        let mut cmd = std::process::Command::new(java_path);

        // Add all arguments
        cmd.args(&args);

        // Set working directory
        cmd.current_dir(game_dir);

        // Detach if requested
        if detached {
            // On Windows, use CREATE_NO_WINDOW flag
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
        }

        // Spawn the process
        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch Minecraft: {}", e))?;

        let pid = child.id();

        Ok(LaunchResult {
            success: true,
            pid: Some(pid),
            error: None,
        })
    }

    // ── Utility ────────────────────────────────────────────────────

    // ── Native Extraction ──────────────────────────────────────────

    /// Extract native libraries (DLLs/.so files) from JARs into the natives directory.
    /// The resulting files can then be loaded via `-Djava.library.path`.
    pub fn extract_natives(
        &self,
        app_handle: &AppHandle,
        natives: Vec<NativeToExtract>,
        game_dir: &str,
    ) -> Result<Vec<String>, String> {
        let natives_dir = PathBuf::from(game_dir).join("natives");
        fs::create_dir_all(&natives_dir)
            .map_err(|e| format!("Failed to create natives dir: {}", e))?;

        let mut extracted = Vec::new();
        let total = natives.len();

        for (i, native) in natives.iter().enumerate() {
            self.emit_progress(app_handle, DownloadProgressEvent {
                phase: "natives".to_string(),
                current: i,
                total,
                status: format!("Wypakowywanie bibliotek natywnych ({}/{})...", i, total),
            });

            let jar_path = self.libraries_dir.join(&native.jar_path);

            if !jar_path.exists() {
                // Skip missing native JARs — some might be optional
                continue;
            }

            // Open the JAR file (which is a ZIP file)
            let jar_file = fs::File::open(&jar_path)
                .map_err(|e| format!("Failed to open native jar {}: {}", native.jar_path, e))?;

            let mut archive = zip::ZipArchive::new(jar_file)
                .map_err(|e| format!("Failed to read native jar {}: {}", native.jar_path, e))?;

            for j in 0..archive.len() {
                let mut entry = archive.by_index(j)
                    .map_err(|e| format!("Failed to read entry in {}: {}", native.jar_path, e))?;

                let entry_name = entry.name().to_string().replace('\\', "/");

                // Skip non-native files (metadata, directories, class files)
                let is_native = entry_name.ends_with(".dll")
                    || entry_name.ends_with(".so")
                    || entry_name.ends_with(".dylib")
                    || entry_name.ends_with(".jnilib");

                if !is_native {
                    continue;
                }

                // Extract the native file — use just the filename (strip path)
                let filename = std::path::Path::new(&entry_name)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .ok_or_else(|| format!("Invalid filename in native jar: {}", entry_name))?;

                let target_path = natives_dir.join(filename);

                let mut data = Vec::new();
                entry.read_to_end(&mut data)
                    .map_err(|e| format!("Failed to read native entry {}: {}", entry_name, e))?;

                let mut out_file = fs::File::create(&target_path)
                    .map_err(|e| format!("Failed to create native file {}: {}", filename, e))?;

                out_file.write_all(&data)
                    .map_err(|e| format!("Failed to write native file {}: {}", filename, e))?;

                extracted.push(target_path.to_string_lossy().to_string());
            }
        }

        // Emit completion
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "natives".to_string(),
            current: total,
            total,
            status: "Wypakowywanie bibliotek natywnych — gotowe".to_string(),
        });

        Ok(extracted)
    }

    // ── Utility ────────────────────────────────────────────────────

    /// Download the client jar and version JSON for a version with progress events.
    /// Both files are required — Minecraft uses the JSON for license verification.
    pub fn download_client_jar(
        &self,
        app_handle: &AppHandle,
        mc_version: &str,
        url: &str,
        expected_size: u64,
    ) -> Result<String, String> {
        let version_dir = self.versions_dir.join(mc_version);
        let jar_path = version_dir.join(format!("{}.jar", mc_version));
        let json_path = version_dir.join(format!("{}.json", mc_version));

        fs::create_dir_all(&version_dir)
            .map_err(|e| format!("Failed to create version dir: {}", e))?;

        // ── Download version JSON (if missing) ───────────────────────
        // Minecraft requires the version JSON alongside the jar for license verification.
        if !json_path.exists() {
            self.emit_progress(app_handle, DownloadProgressEvent {
                phase: "client".to_string(),
                current: 0,
                total: 2,
                status: format!("Pobieranie {}.json...", mc_version),
            });

            let version_manifest_url = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
            let manifest_resp = reqwest::blocking::get(version_manifest_url)
                .map_err(|e| format!("Failed to download version manifest: {}", e))?;

            if !manifest_resp.status().is_success() {
                return Err(format!("HTTP {} downloading version manifest", manifest_resp.status()));
            }

            let manifest: serde_json::Value = manifest_resp.json()
                .map_err(|e| format!("Failed to parse version manifest: {}", e))?;

            // Find version JSON url
            let version_url = manifest["versions"]
                .as_array()
                .and_then(|versions| {
                    versions.iter().find(|v| {
                        v["id"].as_str().map(|id| id == mc_version).unwrap_or(false)
                    })
                })
                .and_then(|v| v["url"].as_str())
                .ok_or_else(|| format!("Version {} not found in manifest", mc_version))?
                .to_string();

            // Download version JSON
            let json_resp = reqwest::blocking::get(&version_url)
                .map_err(|e| format!("Failed to download version JSON: {}", e))?;

            if !json_resp.status().is_success() {
                return Err(format!("HTTP {} downloading version JSON", json_resp.status()));
            }

            let json_bytes = json_resp.bytes()
                .map_err(|e| format!("Failed to read version JSON: {}", e))?;

            fs::write(&json_path, &json_bytes)
                .map_err(|e| format!("Failed to write version JSON: {}", e))?;
        }

        // ── Download client jar (if missing or size mismatch) ────────
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "client".to_string(),
            current: 1,
            total: 2,
            status: "Pobieranie client.jar...".to_string(),
        });

        if jar_path.exists() {
            if let Ok(metadata) = fs::metadata(&jar_path) {
                if metadata.len() == expected_size {
                    self.emit_progress(app_handle, DownloadProgressEvent {
                        phase: "client".to_string(),
                        current: 2,
                        total: 2,
                        status: "Pobieranie client.jar — gotowe".to_string(),
                    });
                    return Ok(jar_path.to_string_lossy().to_string());
                }
            }
        }

        let resp = reqwest::blocking::get(url)
            .map_err(|e| format!("Failed to download client jar: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {} downloading client jar", resp.status()));
        }

        let bytes = resp
            .bytes()
            .map_err(|e| format!("Failed to read client jar: {}", e))?;

        fs::write(&jar_path, &bytes)
            .map_err(|e| format!("Failed to write client jar: {}", e))?;

        // Emit completion
        self.emit_progress(app_handle, DownloadProgressEvent {
            phase: "client".to_string(),
            current: 2,
            total: 2,
            status: "Pobieranie client.jar — gotowe".to_string(),
        });

        Ok(jar_path.to_string_lossy().to_string())
    }
}