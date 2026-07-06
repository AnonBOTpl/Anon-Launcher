use serde::{Deserialize, Serialize};

// ─── Types ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(deserialize = "snake_case", serialize = "camelCase"))]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenPollResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MinecraftSession {
    pub access_token: String,
    pub refresh_token: String,
    pub username: String,
    pub uuid: String,
    pub xuid: String,
    pub expires_at: String,
}

/// Wynik uruchomienia Authorization Code Flow.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAuthCodeFlowResult {
    /// URL do otwarcia w przeglądarce (Microsoft login page)
    pub url: String,
    /// Port na którym nasłuchuje lokalny serwer HTTP
    pub port: u16,
    /// PKCE code verifier — potrzebny do wymiany kodu na token
    pub code_verifier: String,
}

// ─── Endpoints ─────────────────────────────────────────────────────

const MICROSOFT_CLIENT_ID: &str = "316a868f-d3ad-4d0f-be3f-4692d5975c34";

const DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const AUTHORIZE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL: &str =
    "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL: &str =
    "https://api.minecraftservices.com/minecraft/profile";

// ─── Helpers ───────────────────────────────────────────────────────

fn new_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .user_agent("AnonLauncher/0.1.0")
        .build()
        .expect("Failed to create HTTP client")
}

fn post_form(url: &str, body: &str) -> Result<String, String> {
    let resp = new_client()
        .post(url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body.to_string())
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if status.as_u16() != 200 {
        return Err(format!("HTTP error ({}): {}", status, text));
    }

    Ok(text)
}

fn post_json(url: &str, json: &serde_json::Value) -> Result<String, String> {
    let resp = new_client()
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(json)
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if status.as_u16() != 200 {
        return Err(format!("HTTP error ({}): {}", status, text));
    }

    Ok(text)
}

fn get_with_auth(url: &str, token: &str) -> Result<String, String> {
    let resp = new_client()
        .get(url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    if status.as_u16() != 200 {
        return Err(format!("HTTP error ({}): {}", status, text));
    }

    Ok(text)
}

// ─── PKCE Helpers ─────────────────────────────────────────────────

/// Generate a random code verifier for PKCE (43-128 chars).
fn generate_code_verifier() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const LEN: usize = 64;

    let mut rng = rand::thread_rng();
    (0..LEN)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Compute the PKCE code challenge (SHA-256 → base64url-encoded, no padding).
fn generate_code_challenge(verifier: &str) -> String {
    use base64::Engine;
    use sha2::Digest;

    let hash = sha2::Sha256::digest(verifier.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash)
}

/// URL-encode a string for use in query parameters.
fn url_encode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                result.push(byte as char);
            }
            b' ' => result.push_str("%20"),
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

/// Parse the `code` parameter from a localhost callback HTTP request.
/// Expected format: GET /callback?code=xxx&state=yyy HTTP/1.1
fn extract_code_from_request(request: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let query_start = first_line.find('?')?;
    let query_end = first_line.rfind(" HTTP")?;
    let query = &first_line[query_start + 1..query_end];

    for pair in query.split('&') {
        if let Some(eq) = pair.find('=') {
            let key = &pair[..eq];
            let value = &pair[eq + 1..];
            if key == "code" && !value.is_empty() {
                return Some(url_decode(value));
            }
        }
    }
    None
}

/// Simple URL-decode (only decode %XX sequences and + → space).
fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    result
}

// ─── Authorization Code Flow (PKCE) ─────────────────────────────

/// Rozpocznij Authorization Code Flow z PKCE:
/// 1. Generuje code_verifier + code_challenge
/// 2. Uruchamia lokalny serwer HTTP na losowym porcie
/// 3. Zwraca URL do logowania Microsoft + port + verifier
///
/// Frontend otwiera URL w przeglądarce, a serwer HTTP czeka na callback.
/// Gdy Microsoft przekieruje na http://localhost:{port}/callback?code=...,
/// serwer wyciąga `code` z query string i zapisuje w AppState.
pub fn start_auth_code_flow(
    auth_code: std::sync::Arc<std::sync::Mutex<Option<String>>>,
) -> Result<StartAuthCodeFlowResult, String> {
    // Generate PKCE pair
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);

    // Start local HTTP server on random port
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to start local server: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    // Redirect URI: http://localhost:{port} — Azure ma zarejestrowane http://localhost
    // Microsoft dopasowuje http://localhost do dowolnego portu dla aplikacji desktopowych.
    let redirect_uri = format!("http://localhost:{}", port);

    // Build Microsoft authorization URL
    let url = format!(
        "{}?client_id={}&response_type=code&redirect_uri={}&scope={}&code_challenge={}&code_challenge_method=S256",
        AUTHORIZE_URL,
        MICROSOFT_CLIENT_ID,
        url_encode(&redirect_uri),
        url_encode("XboxLive.signin offline_access openid profile"),
        code_challenge,
    );

    // Clear any previous auth code
    *auth_code.lock().map_err(|e| format!("Lock error: {}", e))? = None;

    // Set listener to non-blocking so we can timeout
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to set non-blocking: {}", e))?;

    // Spawn thread to wait for the callback
    let auth_code_clone = auth_code.clone();
    std::thread::spawn(move || {
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_secs(300);

        loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    // Got a connection — read just the request line
                    use std::io::BufRead;
                    let mut reader = std::io::BufReader::new(&stream);
                    let mut request_line = String::new();
                    let _ = reader.read_line(&mut request_line);

                    // Extract authorization code from query string
                    if let Some(code) = extract_code_from_request(&request_line) {
                        if let Ok(mut guard) = auth_code_clone.lock() {
                            *guard = Some(code);
                        }
                    }

                    // Send response back to browser (with redirect URI path)
                    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 250\r\nConnection: close\r\n\r\n<!DOCTYPE html><html><body style=\"font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a2e;color:#fff\"><div style=\"text-align:center\"><h1 style=\"color:#a855f7\">✅ Autoryzacja udana!</h1><p>Możesz zamknąć to okno i wrócić do launcher'a.</p></div></body></html>";
                    let _ = std::io::Write::write_all(&mut &stream, response.as_bytes());
                    break;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // No connection yet — check timeout
                    if start.elapsed() > timeout {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }
                Err(_) => break,
            }
        }
    });

    Ok(StartAuthCodeFlowResult {
        url,
        port,
        code_verifier,
    })
}

/// Sprawdź czy callback z Microsoft został już odebrany.
pub fn poll_auth_code_callback(
    auth_code: &std::sync::Mutex<Option<String>>,
) -> Result<Option<String>, String> {
    let mut guard = auth_code
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(guard.take())
}

/// Wymień authorization code na tokeny (access + refresh).
/// Używa tego samego redirect_uri co w authorization requescie — http://localhost:{port}
pub fn exchange_auth_code(
    code: &str,
    code_verifier: &str,
    redirect_port: u16,
) -> Result<TokenPollResult, String> {
    let redirect_uri = format!("http://localhost:{}", redirect_port);
    let body = format!(
        "client_id={}&grant_type=authorization_code&code={}&redirect_uri={}&code_verifier={}",
        MICROSOFT_CLIENT_ID, code, url_encode(&redirect_uri), code_verifier
    );

    let text = post_form(TOKEN_URL, &body)?;

    let token_data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = token_data["access_token"]
        .as_str()
        .ok_or("Missing access_token")?
        .to_string();
    let refresh_token = token_data["refresh_token"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(TokenPollResult {
        status: "success".to_string(),
        access_token: Some(access_token),
        refresh_token: Some(refresh_token),
        error: None,
    })
}

// ─── Step 1: Start Device Code Flow (legacy) ──────────────────────

pub fn start_device_code_flow() -> Result<DeviceCodeResponse, String> {
    let body = format!(
        "client_id={}&scope=XboxLive.signin%20offline_access&response_type=device_code",
        MICROSOFT_CLIENT_ID
    );

    let text = post_form(DEVICE_CODE_URL, &body)?;

    let device_resp: DeviceCodeResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse device code response: {}", e))?;

    Ok(device_resp)
}

// ─── Step 2: Poll for Token (legacy) ─────────────────────────────

pub fn poll_for_token(device_code: &str) -> Result<TokenPollResult, String> {
    let body = format!(
        "client_id={}&grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code={}",
        MICROSOFT_CLIENT_ID, device_code
    );

    let client = new_client();
    let resp = client
        .post(TOKEN_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .map_err(|e| format!("Failed to poll for token: {}", e))?;

    let status = resp.status();
    let text = resp
        .text()
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Success
    if status.as_u16() == 200 {
        let token_data: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        let access_token = token_data["access_token"]
            .as_str()
            .ok_or("Missing access_token")?
            .to_string();
        let refresh_token = token_data["refresh_token"]
            .as_str()
            .unwrap_or("")
            .to_string();

        return Ok(TokenPollResult {
            status: "success".to_string(),
            access_token: Some(access_token),
            refresh_token: Some(refresh_token),
            error: None,
        });
    }

    // Check for pending / other errors (400 status with error field)
    let error_data: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
    let error_code = error_data["error"].as_str().unwrap_or("unknown");

    match error_code {
        "authorization_pending" => Ok(TokenPollResult {
            status: "pending".to_string(),
            access_token: None,
            refresh_token: None,
            error: None,
        }),
        "slow_down" => Ok(TokenPollResult {
            status: "pending".to_string(),
            access_token: None,
            refresh_token: None,
            error: Some("slow_down".to_string()),
        }),
        "authorization_declined" => Ok(TokenPollResult {
            status: "denied".to_string(),
            access_token: None,
            refresh_token: None,
            error: Some("Użytkownik odrzucił autoryzację".to_string()),
        }),
        "expired_token" => Ok(TokenPollResult {
            status: "expired".to_string(),
            access_token: None,
            refresh_token: None,
            error: Some("Kod wygasł — uruchom logowanie ponownie".to_string()),
        }),
        _ => Err(format!("Unknown error: {} - {}", error_code, text)),
    }
}

// ─── Token Refresh ───────────────────────────────────────────────

/// Wynik odświeżenia tokena Microsoft
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenResult {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: u64,
}

/// Odśwież token Microsoft za pomocą refresh_token.
/// Po odświeżeniu MS tokena przechodzi przez pełny Minecraft auth chain
/// (XBL → XSTS → Minecraft token) — zwraca Minecraft access token, nie MS OAuth token.
pub fn refresh_minecraft_token(refresh_token: &str) -> Result<RefreshTokenResult, String> {
    // Step 1: Odśwież Microsoft OAuth token
    let body = format!(
        "client_id={}&grant_type=refresh_token&refresh_token={}",
        MICROSOFT_CLIENT_ID, refresh_token
    );

    let text = post_form(TOKEN_URL, &body)?;

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse refresh response: {}", e))?;

    let ms_access_token = data["access_token"]
        .as_str()
        .ok_or("Missing access_token in refresh response")?
        .to_string();
    let new_refresh_token = data["refresh_token"]
        .as_str()
        .ok_or("Missing refresh_token in refresh response")?
        .to_string();

    // Step 2: Pełny Minecraft auth chain z nowym MS tokenem
    // Konieczne — MS OAuth token != Minecraft token, Minecraft go odrzuca → tryb demo
    let mc_session = complete_minecraft_auth(&ms_access_token)?;

    Ok(RefreshTokenResult {
        access_token: mc_session.access_token,
        refresh_token: new_refresh_token,
        expires_in: 86400,
    })
}

// ─── Steps 3-6: Complete Minecraft Auth Chain ──────────────────────

pub fn complete_minecraft_auth(ms_access_token: &str) -> Result<MinecraftSession, String> {
    let xbl_token = authenticate_xbl(ms_access_token)?;
    let (xsts_token, user_hash, xuid) = authenticate_xsts(&xbl_token)?;
    let mc_access_token = authenticate_minecraft(&xsts_token, &user_hash)?;
    let (username, uuid) = get_minecraft_profile(&mc_access_token)?;

    let expires_at = (chrono_now_unix() + 86400).to_string();

    Ok(MinecraftSession {
        access_token: mc_access_token,
        refresh_token: String::new(),
        username,
        uuid,
        xuid,
        expires_at,
    })
}

fn authenticate_xbl(ms_token: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let text = post_json(XBL_AUTH_URL, &body)?;

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse XBL response: {}", e))?;

    data["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing XBL token".to_string())
}

fn authenticate_xsts(xbl_token: &str) -> Result<(String, String, String), String> {
    let body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let text = post_json(XSTS_AUTH_URL, &body)?;

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse XSTS response: {}", e))?;

    let token = data["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing XSTS token".to_string())?;

    let user_hash = data["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing user hash (uhs)".to_string())?;

    // Extract Xbox User ID (xid) from XSTS response — needs to be passed to Minecraft 1.21+
    let xuid = data["DisplayClaims"]["xui"][0]["xid"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok((token, user_hash, xuid))
}

fn authenticate_minecraft(xsts_token: &str, user_hash: &str) -> Result<String, String> {
    let body = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
    });

    let text = post_json(MINECRAFT_AUTH_URL, &body)?;

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse Minecraft auth response: {}", e))?;

    data["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing Minecraft access token".to_string())
}

fn get_minecraft_profile(access_token: &str) -> Result<(String, String), String> {
    let text = get_with_auth(MINECRAFT_PROFILE_URL, access_token)?;

    let data: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse profile response: {}", e))?;

    let username = data["name"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing username in profile".to_string())?;

    let uuid = data["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Missing UUID in profile".to_string())?;

    Ok((username, uuid))
}

fn chrono_now_unix() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
