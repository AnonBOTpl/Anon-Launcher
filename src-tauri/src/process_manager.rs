use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, Read};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

// ─── Data structures ────────────────────────────────────────────────

/// Status of a running game instance
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InstanceStatus {
    Idle,
    Launching,
    Running { pid: u32 },
    Stopped { exit_code: Option<i32>, error: Option<String> },
}

/// Result of a launch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchResult {
    pub success: bool,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

/// State of a managed process
struct ManagedProcess {
    child: Option<Child>,
    pid: u32,
}

// ─── Process Manager ────────────────────────────────────────────────

pub struct ProcessManager {
    processes: Mutex<HashMap<String, ManagedProcess>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }

    /// Launch a Minecraft process and start streaming logs via Tauri events.
    /// Returns the PID on success.
    pub fn launch(
        &self,
        app_handle: &AppHandle,
        instance_name: &str,
        java_path: &str,
        args: Vec<String>,
        game_dir: &str,
    ) -> Result<LaunchResult, String> {
        // Check if already running
        {
            let processes = self.processes.lock().map_err(|e| format!("Lock error: {}", e))?;
            if let Some(existing) = processes.get(instance_name) {
                // Check if process is still alive
                if is_process_alive(existing.pid) {
                    return Err(format!(
                        "Instance '{}' is already running (PID: {})",
                        instance_name, existing.pid
                    ));
                }
            }
        }

        // Spawn the Java process
        let mut cmd = Command::new(java_path);
        cmd.args(&args)
            .current_dir(game_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // On Windows, hide the console window
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd.spawn().map_err(|e| format!("Failed to launch Minecraft: {}", e))?;
        let pid = child.id();

        // Take stdout/stderr handles before moving child
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Store process state
        {
            let mut processes = self.processes.lock().map_err(|e| format!("Lock error: {}", e))?;
            processes.insert(
                instance_name.to_string(),
                ManagedProcess {
                    child: Some(child),
                    pid,
                },
            );
        }

        // Emit launched event immediately (no more 500ms monitor thread)
        let _ = app_handle.emit(
            "instance:launched",
            serde_json::json!({
                "instanceName": instance_name,
                "pid": pid,
            }),
        );

        // Merge stdout + stderr into ONE reader to avoid duplicate lines.
        // Minecraft often writes the same content to both streams.
        let app_handle_clone = app_handle.clone();
        let app_handle_stop = app_handle.clone();
        let inst_name = instance_name.to_string();
        let inst_name_stop = instance_name.to_string();
        std::thread::spawn(move || {
            let combined: Box<dyn std::io::Read + Send> = match (stdout, stderr) {
                (Some(out), Some(err)) => Box::new(out.chain(err)),
                (Some(out), None) => Box::new(out),
                (None, Some(err)) => Box::new(err),
                (None, None) => return,
            };

            let reader = std::io::BufReader::new(combined);
            // Deduplicate: track recently seen lines to catch duplicates
            // from both stdout and stderr (which Fabric writes to both).
            // Since chain() reads all of stdout first, then all of stderr,
            // duplicates aren't consecutive — we need a recent-lines buffer.
            let mut recent_lines: HashSet<String> = HashSet::new();
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        // Skip if we've seen this exact line recently
                        if !recent_lines.insert(text.clone()) {
                            continue;
                        }
                        // Keep buffer bounded to avoid memory leak
                        if recent_lines.len() > 100 {
                            recent_lines.clear();
                        }

                        let _ = app_handle_clone.emit(
                            "instance:log",
                            serde_json::json!({
                                "instanceName": inst_name,
                                "stream": "stdout",
                                "text": text,
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }

            // Reader finished — process exited on its own.
            // Emit stopped event so the frontend can update the Play/Stop button.
            // We don't remove from the process map here (Mutex is not Clone in a thread);
            // the stale entry is harmless — get_status() will return Stopped because
            // is_process_alive() will return false for the dead process.
            let _ = app_handle_stop.emit(
                "instance:stopped",
                serde_json::json!({
                    "instanceName": inst_name_stop,
                    "exitCode": null,
                }),
            );
        });

        Ok(LaunchResult {
            success: true,
            pid: Some(pid),
            error: None,
        })
    }

    /// Stop a running instance by killing the process.
    pub fn stop(&self, app_handle: &AppHandle, instance_name: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().map_err(|e| format!("Lock error: {}", e))?;

        if let Some(mut managed) = processes.remove(instance_name) {
            if let Some(ref mut child) = managed.child {
                // Kill the process
                #[cfg(target_os = "windows")]
                {
                    let _ = std::process::Command::new("taskkill")
                        .args(&["/PID", &managed.pid.to_string(), "/F", "/T"])
                        .output();
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let _ = child.kill();
                }

                let exit_code = child.wait().ok().and_then(|s| s.code());

                let _ = app_handle.emit(
                    "instance:stopped",
                    serde_json::json!({
                        "instanceName": instance_name,
                        "exitCode": exit_code,
                    }),
                );

                return Ok(());
            }
        }

        // If not found in our map, try to kill by PID using a system command
        // (fallback: process might be orphaned)
        Err(format!("Instance '{}' is not running", instance_name))
    }

    /// Get the status of a running instance.
    pub fn get_status(&self, instance_name: &str) -> InstanceStatus {
        let processes = match self.processes.lock() {
            Ok(p) => p,
            Err(_) => return InstanceStatus::Idle,
        };

        match processes.get(instance_name) {
            Some(managed) => {
                if is_process_alive(managed.pid) {
                    InstanceStatus::Running { pid: managed.pid }
                } else {
                    InstanceStatus::Stopped {
                        exit_code: None,
                        error: None,
                    }
                }
            }
            None => InstanceStatus::Idle,
        }
    }

    /// List all running instances.
    #[allow(dead_code)]
    pub fn list_running(&self) -> Vec<String> {
        let processes = match self.processes.lock() {
            Ok(p) => p,
            Err(_) => return Vec::new(),
        };

        processes
            .iter()
            .filter(|(_, m)| is_process_alive(m.pid))
            .map(|(name, _)| name.clone())
            .collect()
    }
}

// ─── Helpers ────────────────────────────────────────────────────────

/// Check if a process with the given PID is still alive.
fn is_process_alive(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", pid), "/NH"])
            .output();
        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout.contains(&format!("{}", pid))
            }
            Err(_) => false,
        }
    }

    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("kill")
            .args(&["-0", &pid.to_string()])
            .output();
        output.map(|o| o.status.success()).unwrap_or(false)
    }

    #[cfg(target_os = "linux")]
    {
        std::path::Path::new(&format!("/proc/{}", pid)).exists()
    }
}
