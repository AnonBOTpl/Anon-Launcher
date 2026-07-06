export interface MinecraftVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  url: string;
  time: string;
  releaseTime: string;
}

interface VersionManifestResponse {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export interface FabricLoaderVersion {
  loader: {
    version: string;
    stable: boolean;
    build: number;
    separator: string;
    maven: string;
  };
  launcherMeta: {
    version: number;
    libraries: {
      common: Array<{ name: string; url: string }>;
    };
    mainClass: {
      client: string;
      server: string;
    };
  };
}

const VERSION_MANIFEST_URL = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_BASE = "https://meta.fabricmc.net/v2";

// ─── Cache ──────────────────────────────────────────────────────────

let versionsCache: { data: MinecraftVersion[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Minecraft Versions ─────────────────────────────────────────────

export async function fetchMinecraftVersions(): Promise<MinecraftVersion[]> {
  // Return cached data if still fresh
  if (versionsCache && Date.now() - versionsCache.timestamp < CACHE_TTL) {
    return versionsCache.data;
  }

  const response = await fetch(VERSION_MANIFEST_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch Minecraft versions: ${response.statusText}`);
  }

  const data: VersionManifestResponse = await response.json();

  // Filter to releases and snapshots only, sorted by releaseTime descending
  const filtered = data.versions
    .filter((v) => v.type === "release" || v.type === "snapshot")
    .sort((a, b) => new Date(b.releaseTime).getTime() - new Date(a.releaseTime).getTime());

  versionsCache = { data: filtered, timestamp: Date.now() };

  return filtered;
}

export async function fetchReleaseVersions(): Promise<MinecraftVersion[]> {
  const all = await fetchMinecraftVersions();
  return all.filter((v) => v.type === "release");
}

// ─── Fabric Loader Versions ─────────────────────────────────────────

/**
 * Fetch available Fabric loader versions for a given Minecraft version.
 */
export async function fetchFabricLoaderVersions(
  mcVersion: string,
): Promise<FabricLoaderVersion[]> {
  const url = `${FABRIC_META_BASE}/versions/loader/${encodeURIComponent(mcVersion)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Fabric loader versions for ${mcVersion}: ${response.statusText}`,
    );
  }

  const data: FabricLoaderVersion[] = await response.json();

  // Sort by build number descending (newest first)
  return data.sort((a, b) => b.loader.build - a.loader.build);
}

/**
 * Fetch all available Fabric loader versions (without MC version filter).
 */
export async function fetchAllFabricLoaders(): Promise<FabricLoaderVersion["loader"][]> {
  const url = `${FABRIC_META_BASE}/versions/loader`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch Fabric loaders: ${response.statusText}`);
  }

  const data: FabricLoaderVersion[] = await response.json();

  return data
    .filter((l) => l.loader.stable)
    .sort((a, b) => b.loader.build - a.loader.build)
    .map((l) => l.loader);
}
