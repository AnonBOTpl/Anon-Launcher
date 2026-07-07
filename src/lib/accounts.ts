/**
 * Accounts library — deleguje do backendu Tauri (JSON + Stronghold).
 */

import { invoke } from "@tauri-apps/api/core";
import type { AccountMeta, AccountData } from "@/types/account";
import type { MinecraftSession } from "@/types/auth";
import {
  saveRefreshToken,
  getRefreshToken,
  removeRefreshToken,
} from "@/lib/stronghold";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wyciaga XUID z Minecraft JWT access token.
 * Token zawiera pole xuid w payload (base64url).
 */
function extractXuidFromToken(accessToken: string): string | undefined {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(atob(parts[1]!));
    return payload.xuid ?? payload.xuids?.[0] ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Save a session as a stored account. */
export async function saveAccount(session: MinecraftSession): Promise<void> {
  const accountData: AccountData = {
    uuid: session.uuid,
    username: session.username,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    lastUsed: new Date().toISOString(),
  };    // Save metadata to backend (json file)
  await invoke("save_account", {
    uuid: accountData.uuid,
    username: accountData.username,
  });

  // Save refresh token encrypted in Stronghold vault
  // Stronghold może nie być dostępny (client already loaded) — to nie jest krytyczne
  if (accountData.refreshToken) {
    try {
      await saveRefreshToken(accountData.uuid, accountData.refreshToken);
    } catch (err) {
      console.warn("Failed to save refresh token, continuing:", err);
    }
  }
}

/** List all stored accounts (metadata only, no tokens). */
export async function listAccounts(): Promise<AccountMeta[]> {
  return invoke<AccountMeta[]>("list_accounts");
}

/** Delete an account by UUID. */
export async function deleteAccount(uuid: string): Promise<void> {
  // Remove metadata from backend
  await invoke("delete_account", { uuid });

  // Remove encrypted token from Stronghold
  try {
    await removeRefreshToken(uuid);
  } catch (err) {
    console.warn("Failed to remove token from Stronghold:", err);
  }
  removeSessionFromMap(uuid);
}

/** Set the active account. */
export async function setActiveAccount(uuid: string): Promise<void> {
  await invoke("set_active_account", { uuid });
}

/** Get the active account metadata, or null. */
export async function getActiveAccount(): Promise<AccountMeta | null> {
  return invoke<AccountMeta | null>("get_active_account");
}

/** Full session data returned from backend */
export interface AccountSession {
  uuid: string;
  username: string;
  accessToken: string;
  /** Xbox User ID — potrzebny dla Minecraft 1.21+ gry */
  xuid?: string;
  expiresAt: string;
}

// Klucze localStorage
const SESSION_KEY = "anon_active_session";
const SESSIONS_MAP_KEY = "anon_sessions_map";

/** Zapisz sesję w mapie per-UUID (żeby nie zgubić tokenów przy przełączaniu kont). */
function saveSessionToMap(session: MinecraftSession): void {
  try {
    const raw = localStorage.getItem(SESSIONS_MAP_KEY);
    const map: Record<string, AccountSession> = raw ? JSON.parse(raw) : {};
    map[session.uuid] = {
      uuid: session.uuid,
      username: session.username,
      accessToken: session.accessToken,
      xuid: session.xuid,
      expiresAt: session.expiresAt,
    };
    localStorage.setItem(SESSIONS_MAP_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Failed to save session to map:", err);
  }
}

/** Odczytaj sesję z mapy per-UUID. */
function getSessionFromMap(uuid: string): AccountSession | null {
  try {
    const raw = localStorage.getItem(SESSIONS_MAP_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    const session: AccountSession | undefined = map[uuid];
    if (!session) return null;
    // Jeśli xuid nie został zapisany, wyciągnij go z JWT payload
    if (!session.xuid && session.accessToken) {
      session.xuid = extractXuidFromToken(session.accessToken);
    }
    return session;
  } catch {
    return null;
  }
}

/** Usuń sesję z mapy per-UUID. */
function removeSessionFromMap(uuid: string): void {
  try {
    const raw = localStorage.getItem(SESSIONS_MAP_KEY);
    if (!raw) return;
    const map = JSON.parse(raw);
    delete map[uuid];
    localStorage.setItem(SESSIONS_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Save session data (access token) for launching. */
export async function saveAccountSession(session: MinecraftSession): Promise<void> {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      uuid: session.uuid,
      username: session.username,
      accessToken: session.accessToken,
      xuid: session.xuid,
      expiresAt: session.expiresAt,
    }));
    // Also save to per-account map for account switching
    saveSessionToMap(session);
  } catch (err) {
    console.error("Failed to save session to localStorage:", err);
  }
}

/** Clear session data from localStorage. */
export function clearAccountSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn("Failed to clear session:", err);
  }
}

/** Get session data (access token) for the active account. */
export async function getActiveSession(): Promise<AccountSession | null> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AccountSession;
    // Jeśli xuid nie został zapisany, wyciągnij go z JWT payload
    if (!session.xuid && session.accessToken) {
      session.xuid = extractXuidFromToken(session.accessToken);
    }
    return session;
  } catch {
    return null;
  }
}

/** Refresh token result from backend */
interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Konwertuje expiresAt z backendu (Unix timestamp w sekundach LUB ISO string) na timestamp JS (ms).
 * Rust zwraca np. "1749264000" (sekundy od epoch), ale może też być ISO string.
 */
function parseExpiresAt(expiresAt: string): number {
  const num = parseInt(expiresAt, 10);
  if (!isNaN(num) && num < 1_000_000_000_000) {
    // To Unix timestamp w sekundach → konwertuj na ms
    return num * 1000;
  }
  // Inaczej traktuj jako ISO string lub ms timestamp
  return new Date(expiresAt).getTime();
}

/**
 * Sprawdza czy access token wygasł i odświeża go jeśli trzeba.
 * 1. Pobiera aktywną sesję z backendu
 * 2. Jeśli brak sesji lub wygasła → próbuje odświeżyć refresh tokenem
 * 3. Zapisuje nową sesję w backendzie
 * 4. Zwraca odświeżoną sesję lub null
 */
export async function tryRefreshSession(): Promise<AccountSession | null> {
  // 1. Pobierz aktywny account (metadata)
  const account = await getActiveAccount();
  if (!account) {
    console.log("[tryRefreshSession] No active account found");
    return null;
  }

  // 2. Sprawdź czy mamy ważną sesję w backendzie
  let session = await getActiveSession();
  if (session) {
    const expiresAt = parseExpiresAt(session.expiresAt);
    const now = Date.now();
    console.log(`[tryRefreshSession] Session expiresAt=${expiresAt}, now=${now}, remaining=${(expiresAt - now) / 1000}s`);
    // Jeśli ważny jeszcze przez 5+ minut, użyj go (TYLKO jeśli należy do aktywnego konta!)
    if (!isNaN(expiresAt) && expiresAt > now + 5 * 60 * 1000) {
      if (session.uuid === account.uuid) {
        console.log("[tryRefreshSession] Session still valid, using cached");
        return session;
      }
      console.log("[tryRefreshSession] Cached session belongs to different account, refreshing...");
    }
  }

  // 3. Spróbuj odczytać sesję z mapy per-UUID (szybsze niż refresh token)
  const mappedSession = getSessionFromMap(account.uuid);
  if (mappedSession) {
    const expiresAt = parseExpiresAt(mappedSession.expiresAt);
    const now = Date.now();
    if (!isNaN(expiresAt) && expiresAt > now + 5 * 60 * 1000) {
      // Update active session slot so next launch hits cache directly
      localStorage.setItem(SESSION_KEY, JSON.stringify(mappedSession));
      console.log("[tryRefreshSession] Found valid session in map for", account.uuid);
      return mappedSession;
    }
  }

  // 4. Sesja wygasła lub brak — spróbuj odświeżyć refresh tokenem
  try {
    const refreshToken = await getRefreshToken(account.uuid);
    if (!refreshToken) {
      console.log("[tryRefreshSession] No refresh token in Stronghold for", account.uuid);
      return null;
    }
    console.log("[tryRefreshSession] Refreshing token...");

    // Zachowaj xuid ze starej sesji (jeśli istniała)
    const oldSession = await getActiveSession();
    const oldXuid = oldSession?.xuid;

    const result = await invoke<RefreshResult>("refresh_minecraft_token", {
      refreshToken,
    });
    console.log("[tryRefreshSession] Refresh successful");

    // 4. Nowa sesja — zachowaj xuid ze starej
    const newSession: MinecraftSession = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      username: account.username,
      uuid: account.uuid,
      xuid: oldXuid,
      expiresAt: new Date(Date.now() + result.expiresIn * 1000).toISOString(),
    };

    // 5. Zapisz nowy refresh token w Stronghold (rotacja!)
    await saveRefreshToken(account.uuid, result.refreshToken);

    // 6. Zapisz nową sesję w backendzie
    await saveAccountSession(newSession);

    return {
      uuid: newSession.uuid,
      username: newSession.username,
      accessToken: newSession.accessToken,
      xuid: newSession.xuid,
      expiresAt: newSession.expiresAt,
    };
  } catch (err) {
    console.error("[tryRefreshSession] Failed to refresh token:", err);
    return null;
  }
}
