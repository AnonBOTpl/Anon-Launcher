/**
 * Minecraft player skin/avatar utilities.
 * Uses mc-heads.net for reliable, cached avatar rendering.
 *
 * MC-Heads API:
 *   https://mc-heads.net/avatar/<uuid>/<size>  — 2D head
 *   https://mc-heads.net/head/<uuid>            — just head (64x64)
 *   https://mc-heads.net/body/<uuid>            — full body render
 */

const MC_HEADS_BASE = "https://mc-heads.net";

/**
 * Normalize UUID: trim and treat falsy or empty string as undefined.
 */
function normalizeUuid(uuid?: string | null): string | undefined {
  if (!uuid || uuid.trim() === "") return undefined;
  return uuid.trim();
}

/**
 * Get the 2D avatar (head) URL for a player UUID.
 * Falls back to Steve avatar if UUID is empty or falsy.
 */
export function getAvatarUrl(uuid?: string | null, size = 64): string {
  const normalized = normalizeUuid(uuid);
  if (!normalized) return getSteveAvatar();
  return `${MC_HEADS_BASE}/avatar/${normalized}/${size}.png`;
}

/**
 * Get the full body render URL for a player UUID.
 */
export function getBodyUrl(uuid?: string | null, size = 150): string {
  const normalized = normalizeUuid(uuid);
  if (!normalized) return getSteveBody();
  return `${MC_HEADS_BASE}/body/${normalized}/${size}.png`;
}

/** Steve fallback avatar URL (default player head) */
export function getSteveAvatar(): string {
  return `${MC_HEADS_BASE}/avatar/steve/64.png`;
}

/** Steve fallback body render URL */
export function getSteveBody(): string {
  return `${MC_HEADS_BASE}/body/steve/150.png`;
}

/**
 * Preload an image URL into the browser cache.
 * Returns a promise that resolves when the image loads or rejects on error.
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
