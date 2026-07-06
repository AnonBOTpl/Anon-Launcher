use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ─── Data structures ────────────────────────────────────────────────

/// Account metadata (stored in JSON, no sensitive data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountMeta {
    pub uuid: String,
    pub username: String,
    pub last_used: String,
    pub offline: bool,
}

/// Full session data (including access token) for launching Minecraft.
/// Access token is valid for ~24 hours.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSessionData {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub expires_at: String,
}

/// Persisted accounts file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccountsStore {
    accounts: HashMap<String, AccountMeta>,
    active_uuid: Option<String>,
}

// ─── Account Manager ───────────────────────────────────────────────

pub struct AccountManager {
    data_dir: PathBuf,
}

impl AccountManager {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let data_dir = app_data_dir.join("accounts");
        Self { data_dir }
    }

    // ── Helpers ────────────────────────────────────────────────────

    fn store_path(&self) -> PathBuf {
        self.data_dir.join("accounts.json")
    }

    fn ensure_dir(&self) -> Result<(), String> {
        fs::create_dir_all(&self.data_dir)
            .map_err(|e| format!("Failed to create accounts dir: {}", e))
    }

    fn load_store(&self) -> Result<AccountsStore, String> {
        let path = self.store_path();
        if !path.exists() {
            return Ok(AccountsStore {
                accounts: HashMap::new(),
                active_uuid: None,
            });
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read accounts file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse accounts file: {}", e))
    }

    fn save_store(&self, store: &AccountsStore) -> Result<(), String> {
        self.ensure_dir()?;
        let content = serde_json::to_string_pretty(store)
            .map_err(|e| format!("Failed to serialize accounts: {}", e))?;
        fs::write(self.store_path(), content)
            .map_err(|e| format!("Failed to write accounts file: {}", e))
    }

    // ── Public API ─────────────────────────────────────────────────

    /// Save (create or update) account metadata. Tokens stored separately in Stronghold.
    pub fn save_account(
        &self,
        uuid: &str,
        username: &str,
        offline: bool,
    ) -> Result<(), String> {
        let mut store = self.load_store()?;

        let meta = AccountMeta {
            uuid: uuid.to_string(),
            username: username.to_string(),
            last_used: now_unix_string(),
            offline,
        };

        store.accounts.insert(uuid.to_string(), meta);
        self.save_store(&store)
    }

    /// List all stored accounts (metadata only, no tokens).
    /// Sorted: active first, then by last_used descending.
    pub fn list_accounts(&self) -> Result<Vec<AccountMeta>, String> {
        let store = self.load_store()?;
        let mut accounts: Vec<AccountMeta> = store.accounts.into_values().collect();
        let active = &store.active_uuid;
        accounts.sort_by(|a, b| {
            let a_active = Some(&a.uuid) == active.as_ref();
            let b_active = Some(&b.uuid) == active.as_ref();
            if a_active && !b_active {
                std::cmp::Ordering::Less
            } else if !a_active && b_active {
                std::cmp::Ordering::Greater
            } else {
                b.last_used.cmp(&a.last_used)
            }
        });
        Ok(accounts)
    }

    /// Delete an account by UUID. Clears active if it was the deleted one.
    pub fn delete_account(&self, uuid: &str) -> Result<(), String> {
        let mut store = self.load_store()?;
        store.accounts.remove(uuid);
        if store.active_uuid.as_deref() == Some(uuid) {
            store.active_uuid = None;
        }
        self.save_store(&store)
    }

    /// Set the active account by UUID.
    pub fn set_active_account(&self, uuid: &str) -> Result<(), String> {
        let mut store = self.load_store()?;
        if !store.accounts.contains_key(uuid) {
            return Err(format!("Account '{}' not found", uuid));
        }
        store.active_uuid = Some(uuid.to_string());
        self.save_store(&store)
    }

    /// Get the active account metadata, if any.
    pub fn get_active_account(&self) -> Result<Option<AccountMeta>, String> {
        let store = self.load_store()?;
        match &store.active_uuid {
            Some(uuid) => Ok(store.accounts.get(uuid).cloned()),
            None => Ok(None),
        }
    }

    // ── Session Data (access token for launching) ──────────────────

    fn sessions_path(&self) -> PathBuf {
        self.data_dir.join("sessions.json")
    }

    fn load_sessions(&self) -> Result<HashMap<String, AccountSessionData>, String> {
        let path = self.sessions_path();
        if !path.exists() {
            return Ok(HashMap::new());
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read sessions file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse sessions file: {}", e))
    }

    fn save_sessions(&self, sessions: &HashMap<String, AccountSessionData>) -> Result<(), String> {
        self.ensure_dir()?;
        let content = serde_json::to_string_pretty(sessions)
            .map_err(|e| format!("Failed to serialize sessions: {}", e))?;
        fs::write(self.sessions_path(), content)
            .map_err(|e| format!("Failed to write sessions file: {}", e))
    }

    /// Save session data (access token) for an account.
    pub fn save_account_session(&self, session: &AccountSessionData) -> Result<(), String> {
        let mut sessions = self.load_sessions()?;
        sessions.insert(session.uuid.clone(), session.clone());
        self.save_sessions(&sessions)
    }

    /// Get session data (access token) for the active account, or None.
    pub fn get_active_account_session(&self) -> Result<Option<AccountSessionData>, String> {
        let store = self.load_store()?;
        let active_uuid = match &store.active_uuid {
            Some(uuid) => uuid,
            None => return Ok(None),
        };
        let sessions = self.load_sessions()?;
        Ok(sessions.get(active_uuid).cloned())
    }
}

/// Current Unix timestamp (seconds since epoch) as string.
/// Used for consistent sorting of accounts by last_used.
pub fn now_unix_string() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now.to_string()
}
