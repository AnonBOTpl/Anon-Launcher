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

// ─── NeoForge Versions ────────────────────────────────────────────

// In-memory cache for NeoForge versions (all versions from Maven)
let neoforgeAllVersionsCache: { data: string[]; timestamp: number } | null = null;

/**
 * Fetch all NeoForge versions for a Minecraft version.
 * NeoForge uses short MC version format (e.g. "21.4") internally.
 */
export async function fetchAllNeoForgeVersions(mcVersion: string): Promise<string[]> {
  const NEOFORGE_MAVEN_URL = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
  const CACHE_TTL_NF = 10 * 60 * 1000; // 10 minutes

  // Return cached data if still fresh
  if (neoforgeAllVersionsCache && Date.now() - neoforgeAllVersionsCache.timestamp < CACHE_TTL_NF) {
    return filterNeoForgeVersions(neoforgeAllVersionsCache.data, mcVersion);
  }

  const response = await fetch(NEOFORGE_MAVEN_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch NeoForge versions: ${response.statusText}`);
  }

  const data: { versions: string[] } = await response.json();

  // Sort descending (newest first)
  const sorted = (data.versions || []).sort().reverse();
  neoforgeAllVersionsCache = { data: sorted, timestamp: Date.now() };

  return filterNeoForgeVersions(sorted, mcVersion);
}

/**
 * Filter NeoForge versions by Minecraft version.
 * NeoForge uses short MC version format internally.
 * e.g. "1.21.4" → "21.4" → matches "21.4.8"
 */
function filterNeoForgeVersions(versions: string[], mcVersion: string): string[] {
  // For NeoForge, version numbers are like "21.4.8" where "21.4" is the MC version
  // Convert "1.21.4" to "21.4"
  const shortVer = mcVersion.replace(/^1\./, "");
  return versions.filter((v) => v.startsWith(shortVer + "."));
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
