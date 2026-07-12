/**
 * Stronghold encrypted token storage wrapper.
 *
 * Przechowuje refresh tokeny w zaszyfrowanym vault zamiast plaintext JSON.
 */

import { Stronghold } from "@tauri-apps/plugin-stronghold";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";

// ─── Constants ──────────────────────────────────────────────────────

const CLIENT_NAME = "anon-launcher";
const TOKEN_KEY_PREFIX = "refresh_token_";

// ─── Singleton state ────────────────────────────────────────────────

let strongholdInstance: Stronghold | null = null;
let clientInstance: Awaited<ReturnType<Stronghold["loadClient"]>> | null = null;
let initializing: Promise<boolean> | null = null;

// ─── Helpers ────────────────────────────────────────────────────────

function stringToNumberArray(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

function numberArrayToString(arr: number[] | Uint8Array): string {
  return new TextDecoder().decode(new Uint8Array(arr));
}

// ─── Initialization ─────────────────────────────────────────────────

async function ensureInitialized(): Promise<{
  stronghold: Stronghold;
  client: Awaited<ReturnType<Stronghold["loadClient"]>>;
} | null> {
  if (strongholdInstance && clientInstance) {
    return { stronghold: strongholdInstance, client: clientInstance };
  }

  if (!initializing) {
    initializing = (async () => {
      try {
        const appData = await appDataDir();
        const vaultPath = await join(appData, "accounts", "vault.hold");

        // Pobierz losowo wygenerowany klucz z backendu Rusta (per-installacja)
        const vaultPassword = await invoke<string>("get_stronghold_password");
        strongholdInstance = await Stronghold.load(vaultPath, vaultPassword);

        // Try to load the client first (for subsequent calls within same session)
        try {
          clientInstance = await strongholdInstance.loadClient(CLIENT_NAME);
          return true;
        } catch {
          // Client doesn't exist yet — create it
          try {
            clientInstance = await strongholdInstance.createClient(CLIENT_NAME);
            return true;
          } catch {
            // Client already loaded by Tauri plugin — can't load/create twice.
            // Log and continue without client — we'll fall back to map storage.
            console.warn("[Stronghold] Client init failed, refresh tokens won't persist:", "already loaded or created");
            return false;
          }
        }
      } catch (err) {
        console.warn("[Stronghold] Initialization failed:", err);
        strongholdInstance = null;
        return false;
      }
    })();
  }

  const ok = await initializing;
  if (!ok || !strongholdInstance || !clientInstance) return null;
  return { stronghold: strongholdInstance, client: clientInstance };
}


// ─── Public API ─────────────────────────────────────────────────────

/** Save a refresh token encrypted in Stronghold vault. */
export async function saveRefreshToken(uuid: string, token: string): Promise<void> {
  const ctx = await ensureInitialized();
  if (!ctx) {
    console.warn("[Stronghold] Not available, skipping save");
    return;
  }
  try {
    const store = ctx.client.getStore();
    const key = `${TOKEN_KEY_PREFIX}${uuid}`;
    await store.insert(key, stringToNumberArray(token));
    await ctx.stronghold.save();
  } catch (err) {
    console.warn("[Stronghold] Save failed:", err);
  }
}

/** Read a refresh token from Stronghold vault. Returns null if not found. */
export async function getRefreshToken(uuid: string): Promise<string | null> {
  const ctx = await ensureInitialized();
  if (!ctx) {
    console.warn("[Stronghold] Not available, skipping read");
    return null;
  }
  try {
    const store = ctx.client.getStore();
    const key = `${TOKEN_KEY_PREFIX}${uuid}`;
    const data = await store.get(key);
    if (!data) return null;
    return numberArrayToString(data);
  } catch (err) {
    console.warn("[Stronghold] Read failed:", err);
    return null;
  }
}

/** Remove a refresh token from Stronghold vault. */
export async function removeRefreshToken(uuid: string): Promise<void> {
  const ctx = await ensureInitialized();
  if (!ctx) return;
  try {
    const store = ctx.client.getStore();
    const key = `${TOKEN_KEY_PREFIX}${uuid}`;
    await store.remove(key);
    await ctx.stronghold.save();
  } catch (err) {
    console.warn("[Stronghold] Remove failed:", err);
  }
}
