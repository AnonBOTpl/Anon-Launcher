mod account_manager;
mod auth;
mod content_installer;
mod instance_manager;
mod java_manager;
mod manifest;
mod manifest_migration;
mod minecraft_core;
mod dependency_resolver;
mod mod_installer;
mod modpack_installer;
mod process_manager;
mod snapshot;
mod zip_export;
mod zip_import;

use account_manager::AccountManager;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

// ─── Application State ──────────────────────────────────────────────

use std::sync::Arc;

struct AppState {
    app_data_dir: Mutex<Option<std::path::PathBuf>>,
    process_manager: Mutex<process_manager::ProcessManager>,
    auth_code: Arc<Mutex<Option<String>>>,
    modpack_cancel: Arc<std::sync::atomic::AtomicBool>,
}

// ─── Tauri Commands ─────────────────────────────────────────────────

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Witaj, {}! Aplikacja AnonLauncher działa poprawnie.", name)
}

#[tauri::command]
fn create_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    input: manifest::CreateInstanceInput,
) -> Result<manifest::InstanceManifest, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::create_instance(&app_data_dir, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_manifest(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<manifest::ReadManifestResult, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::read_manifest(&app_data_dir, &instance_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_instances(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<manifest::InstanceManifest>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::list_instances(&app_data_dir).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::delete_instance(&app_data_dir, &instance_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    old_name: String,
    new_manifest: manifest::InstanceManifest,
) -> Result<manifest::InstanceManifest, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::update_instance(&app_data_dir, &old_name, new_manifest).map_err(|e| e.to_string())
}

#[tauri::command]
fn clone_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    source_name: String,
    new_name: String,
) -> Result<manifest::InstanceManifest, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    instance_manager::clone_instance(&app_data_dir, &source_name, &new_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_mod_dependencies(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    dependencies: Vec<serde_json::Value>,
) -> Result<dependency_resolver::ResolveDependenciesResult, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    dependency_resolver::resolve_dependencies(&app_data_dir, &instance_name, dependencies)
}

#[tauri::command]
fn open_instance_folder(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let instances_dir = app_data_dir.join("instances");
    let instance_dir = instances_dir.join(sanitize_name(&instance_name));

    if !instance_dir.exists() {
        return Err(format!("Instance '{}' not found", instance_name));
    }

    // Platform-specific commands to open file manager
    #[cfg(target_os = "windows")]
    let cmd = "explorer";
    #[cfg(target_os = "windows")]
    let args = [instance_dir.to_string_lossy().to_string()];

    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(target_os = "macos")]
    let args = [instance_dir.to_string_lossy().to_string()];

    #[cfg(target_os = "linux")]
    let cmd = "xdg-open";
    #[cfg(target_os = "linux")]
    let args = [instance_dir.to_string_lossy().to_string()];

    std::process::Command::new(cmd)
        .arg(&args[0])
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}

/// Helper to sanitize instance names (used by multiple commands)
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

#[tauri::command]
fn export_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    output_path: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;

    // Count total files first to validate instance exists
    let total = zip_export::count_files(&app_data_dir, &instance_name)
        .map_err(|e| e.to_string())?;

    if total == 0 {
        return Err("No files found in instance directory".to_string());
    }

    // Launch background thread — returns immediately
    zip_export::export_instance_background(
        app_handle.clone(),
        app_data_dir,
        instance_name,
        std::path::PathBuf::from(&output_path),
        total,
    );

    Ok(())
}

#[tauri::command]
fn validate_import_zip(zip_path: String) -> Result<zip_import::ZipValidation, String> {
    zip_import::validate_import_zip(&std::path::PathBuf::from(&zip_path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    zip_path: String,
    new_name: Option<String>,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    zip_import::import_instance(
        &app_data_dir,
        &std::path::PathBuf::from(&zip_path),
        new_name.as_deref(),
    )
    .map_err(|e| e.to_string())
}

// ─── Auth Commands ─────────────────────────────────────────────────

#[tauri::command]
fn start_device_code_flow() -> Result<auth::DeviceCodeResponse, String> {
    auth::start_device_code_flow()
}

#[tauri::command]
fn poll_for_token(device_code: String) -> Result<auth::TokenPollResult, String> {
    auth::poll_for_token(&device_code)
}

#[tauri::command]
fn complete_minecraft_auth(ms_access_token: String) -> Result<auth::MinecraftSession, String> {
    auth::complete_minecraft_auth(&ms_access_token)
}

#[tauri::command]
fn refresh_minecraft_token(refresh_token: String) -> Result<auth::RefreshTokenResult, String> {
    auth::refresh_minecraft_token(&refresh_token)
}

// ─── Auth Code Flow (PKCE) Commands ────────────────────────────────

#[tauri::command]
fn start_auth_code_flow(
    state: State<'_, AppState>,
) -> Result<auth::StartAuthCodeFlowResult, String> {
    auth::start_auth_code_flow(state.auth_code.clone())
}

#[tauri::command]
fn poll_auth_code_callback(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    auth::poll_auth_code_callback(&state.auth_code)
}

#[tauri::command]
fn exchange_auth_code(
    code: String,
    code_verifier: String,
    redirect_port: u16,
) -> Result<auth::TokenPollResult, String> {
    auth::exchange_auth_code(&code, &code_verifier, redirect_port)
}

// ─── Account Commands ─────────────────────────────────────────────

#[tauri::command]
fn save_account(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    uuid: String,
    username: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.save_account(&uuid, &username)
}

#[tauri::command]
fn list_accounts(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<account_manager::AccountMeta>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.list_accounts()
}

#[tauri::command]
fn delete_account(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    uuid: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.delete_account(&uuid)
}

#[tauri::command]
fn set_active_account(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    uuid: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.set_active_account(&uuid)
}

#[tauri::command]
fn get_active_account(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<account_manager::AccountMeta>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.get_active_account()
}

#[tauri::command]
fn save_account_session(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    session: account_manager::AccountSessionData,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.save_account_session(&session)
}

#[tauri::command]
fn get_active_account_session(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<account_manager::AccountSessionData>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = AccountManager::new(&app_data_dir);
    manager.get_active_account_session()
}

// ─── Java Commands ────────────────────────────────────────────────

#[tauri::command]
fn get_java_versions(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<java_manager::JavaVersionInfo>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = java_manager::JavaManager::new(&app_data_dir);
    manager.list_versions()
}

#[tauri::command]
fn download_java(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    version: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    java_manager::JavaManager::download_java_background(
        app_handle.clone(),
        app_data_dir,
        version,
    );
    Ok(())
}

#[tauri::command]
fn get_java_path(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    version: String,
) -> Result<String, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let manager = java_manager::JavaManager::new(&app_data_dir);
    manager.get_java_path(&version)
}

#[tauri::command]
fn verify_java_path(path: String) -> Result<String, String> {
    java_manager::JavaManager::verify_custom_path(&path)
}

// ─── Minecraft Core Commands ────────────────────────────────────────

#[tauri::command]
fn download_libraries(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    libraries: Vec<minecraft_core::LibraryToDownload>,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    minecraft_core::MinecraftCore::download_libraries_background(
        app_handle.clone(),
        app_data_dir,
        libraries,
    );
    Ok(())
}

#[tauri::command]
fn download_client_jar(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    mc_version: String,
    url: String,
    expected_size: u64,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    minecraft_core::MinecraftCore::download_client_jar_background(
        app_handle.clone(),
        app_data_dir,
        mc_version,
        url,
        expected_size,
    );
    Ok(())
}

#[tauri::command]
fn download_assets(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    index: minecraft_core::AssetIndexToDownload,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    minecraft_core::MinecraftCore::download_assets_background(
        app_handle.clone(),
        app_data_dir,
        index,
    );
    Ok(())
}

#[tauri::command]
fn extract_natives(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    natives: Vec<minecraft_core::NativeToExtract>,
    game_dir: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    minecraft_core::MinecraftCore::extract_natives_background(
        app_handle.clone(),
        app_data_dir,
        natives,
        game_dir,
    );
    Ok(())
}

#[tauri::command]
fn launch_minecraft(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    java_path: String,
    args: Vec<String>,
    game_dir: String,
    detached: bool,
) -> Result<minecraft_core::LaunchResult, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let core = minecraft_core::MinecraftCore::new(&app_data_dir);
    core.launch_minecraft(&java_path, args, &game_dir, detached)
}

// ─── Launch Commands ────────────────────────────────────────────────

#[tauri::command]
fn launch_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    java_path: String,
    args: Vec<String>,
) -> Result<process_manager::LaunchResult, String> {
    // Compute game directory from instance name
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    let instances_dir = app_data_dir.join("instances");
    let game_dir = instances_dir.join(sanitize_name(&instance_name));

    let manager = state.process_manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.launch(
        &app_handle,
        &instance_name,
        &java_path,
        args,
        &game_dir.to_string_lossy(),
    )
}

#[tauri::command]
fn stop_instance(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<(), String> {
    let manager = state.process_manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.stop(&app_handle, &instance_name)
}

#[tauri::command]
fn get_instance_status(
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<process_manager::InstanceStatus, String> {
    let manager = state.process_manager.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(manager.get_status(&instance_name))
}

// ─── Helpers ────────────────────────────────────────────────────────

// ─── Mod Installer Commands ─────────────────────────────────────────

#[tauri::command]
fn install_mod(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    version_id: String,
    version_number: String,
    download_url: String,
    file_name: String,
    mod_name: String,
    project_slug: Option<String>,
    icon_url: Option<String>,
) -> Result<mod_installer::InstalledMod, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    mod_installer::install_mod(&app_data_dir, &instance_name, version_id, version_number, download_url, file_name, mod_name, project_slug, icon_url)
}

#[tauri::command]
fn list_mods(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<Vec<mod_installer::InstalledMod>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    mod_installer::list_mods(&app_data_dir, &instance_name)
}

#[tauri::command]
fn toggle_mod(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    file_name: String,
    enabled: bool,
) -> Result<mod_installer::InstalledMod, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    mod_installer::toggle_mod(&app_data_dir, &instance_name, file_name, enabled)
}

#[tauri::command]
fn remove_mod(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    file_name: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    mod_installer::remove_mod(&app_data_dir, &instance_name, file_name)
}

#[tauri::command]
fn update_mod(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    old_file_name: String,
    new_file_name: String,
    download_url: String,
    new_version_id: String,
    new_version_number: String,
    icon_url: Option<String>,
) -> Result<mod_installer::InstalledMod, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    mod_installer::update_mod(
        &app_data_dir,
        &instance_name,
        old_file_name,
        new_file_name,
        download_url,
        new_version_id,
        new_version_number,
        icon_url,
    )
}

// ─── Content Installer Commands ───────────────────────────────────

#[tauri::command]
fn install_instance_content(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    folder: String,
    file_name: String,
    download_url: String,
) -> Result<content_installer::InstalledContent, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    content_installer::install_content(&app_data_dir, &instance_name, &folder, &file_name, &download_url)
}

#[tauri::command]
fn list_instance_content(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    folder: String,
) -> Result<Vec<content_installer::InstalledContent>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    content_installer::list_content(&app_data_dir, &instance_name, &folder)
}

#[tauri::command]
fn remove_instance_content(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    folder: String,
    file_name: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    content_installer::remove_content(&app_data_dir, &instance_name, &folder, &file_name)
}

// ─── Modpack Installer Commands ─────────────────────────────────────

#[tauri::command]
fn create_instance_from_modpack(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    input: modpack_installer::CreateFromModpackInput,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;

    // Reset cancel flag before starting
    state.modpack_cancel.store(false, std::sync::atomic::Ordering::SeqCst);

    modpack_installer::create_from_modpack_background(
        app_handle,
        app_data_dir,
        input,
        state.modpack_cancel.clone(),
    );

    Ok(())
}

#[tauri::command]
fn cancel_modpack_installation(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.modpack_cancel.store(true, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}

// ─── Snapshot Commands ────────────────────────────────────────────

#[tauri::command]
fn create_snapshot(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    mode: String,
) -> Result<snapshot::SnapshotInfo, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    snapshot::create_snapshot(&app_data_dir, &instance_name, &mode).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_snapshots(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
) -> Result<Vec<snapshot::SnapshotInfo>, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    snapshot::list_snapshots(&app_data_dir, &instance_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_snapshot(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    timestamp: String,
) -> Result<(), String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    snapshot::delete_snapshot(&app_data_dir, &instance_name, &timestamp).map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_snapshot(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    instance_name: String,
    timestamp: String,
    mode: String,
) -> Result<snapshot::RestoreResult, String> {
    let app_data_dir = get_app_data_dir(&app_handle, &state)?;
    snapshot::restore_snapshot(&app_data_dir, &instance_name, &timestamp, &mode).map_err(|e| e.to_string())
}

fn get_app_data_dir(app_handle: &AppHandle, state: &State<'_, AppState>) -> Result<std::path::PathBuf, String> {
    let mut guard = state.app_data_dir.lock().map_err(|e| format!("Lock error: {}", e))?;

    match guard.as_ref() {
        Some(dir) => Ok(dir.clone()),
        None => {
            let dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            let cached = dir.clone();
            *guard = Some(dir);
            Ok(cached)
        }
    }
}

// ─── App Entry Point ────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold_salt.txt");

            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path)
                    .build(),
            )?;
            Ok(())
        })
        .manage(AppState {
            app_data_dir: Mutex::new(None),
            process_manager: Mutex::new(process_manager::ProcessManager::new()),
            auth_code: Arc::new(Mutex::new(None)),
            modpack_cancel: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            install_mod,
            list_mods,
            toggle_mod,
            remove_mod,
            update_mod,
            resolve_mod_dependencies,
            create_snapshot,
            list_snapshots,
            delete_snapshot,
            restore_snapshot,
            create_instance,
            read_manifest,
            list_instances,
            delete_instance,
            update_instance,
            clone_instance,
            export_instance,
            validate_import_zip,
            import_instance,
            open_instance_folder,
            start_device_code_flow,
            poll_for_token,
            complete_minecraft_auth,
            refresh_minecraft_token,
            start_auth_code_flow,
            poll_auth_code_callback,
            exchange_auth_code,
            save_account,
            list_accounts,
            delete_account,
            set_active_account,
            get_active_account,
            save_account_session,
            get_active_account_session,
            get_java_versions,
            download_java,
            get_java_path,
            verify_java_path,
            download_libraries,
            download_client_jar,
            download_assets,
            extract_natives,
            launch_minecraft,
            launch_instance,
            stop_instance,
            get_instance_status,
            install_instance_content,
            list_instance_content,
            remove_instance_content,
            create_instance_from_modpack,
            cancel_modpack_installation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
