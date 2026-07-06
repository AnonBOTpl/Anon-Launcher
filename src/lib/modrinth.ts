/**
 * Modrinth API v2 client.
 * Docs: https://docs.modrinth.com/api/
 */

import type {
  ModrinthSearchResponse,
  ModrinthProject,
  ModrinthVersion,
  ModrinthSortIndex,
} from "@/types/modrinth";

const API_BASE = "https://api.modrinth.com/v2";

// ─── Cache ──────────────────────────────────────────────────────────

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry<ModrinthSearchResponse>>();
const projectCache = new Map<string, CacheEntry<ModrinthProject>>();
const versionsCache = new Map<string, CacheEntry<ModrinthVersion[]>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── API calls ──────────────────────────────────────────────────────

/**
 * Search for mods on Modrinth.
 */
export async function searchMods(params: {
  query: string;
  facets?: string[][];
  index?: ModrinthSortIndex;
  limit?: number;
  offset?: number;
}): Promise<ModrinthSearchResponse> {
  const { query, facets, index = "relevance", limit = 20, offset = 0 } = params;

  const searchParams = new URLSearchParams();
  searchParams.set("query", query);
  searchParams.set("index", index);
  searchParams.set("limit", String(limit));
  searchParams.set("offset", String(offset));

  if (facets && facets.length > 0) {
    searchParams.set("facets", JSON.stringify(facets));
  }

  const cacheKey = searchParams.toString();
  const cached = getCached(searchCache, cacheKey);
  if (cached) return cached;

  const url = `${API_BASE}/search?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Przekroczono limit zapytań do Modrinth. Spróbuj za chwilę.");
    }
    throw new Error(`Błąd API Modrinth: ${response.status} ${response.statusText}`);
  }

  const data: ModrinthSearchResponse = await response.json();
  setCache(searchCache, cacheKey, data);
  return data;
}

/**
 * Get full project details from Modrinth.
 */
export async function getProject(slug: string): Promise<ModrinthProject> {
  const cached = getCached(projectCache, slug);
  if (cached) return cached;

  const url = `${API_BASE}/project/${encodeURIComponent(slug)}`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Przekroczono limit zapytań do Modrinth.");
    }
    if (response.status === 404) {
      throw new Error("Projekt nie znaleziony.");
    }
    throw new Error(`Błąd API: ${response.status}`);
  }

  const data: ModrinthProject = await response.json();
  setCache(projectCache, slug, data);
  return data;
}

/**
 * Get versions of a project, filtered by loaders and game versions.
 */
export async function getProjectVersions(
  slug: string,
  options?: {
    loaders?: string[];
    gameVersions?: string[];
  },
): Promise<ModrinthVersion[]> {
  const cacheKey = `${slug}?loaders=${options?.loaders?.join(",") ?? ""}&gameVersions=${options?.gameVersions?.join(",") ?? ""}`;
  const cached = getCached(versionsCache, cacheKey);
  if (cached) return cached;

  const url = `${API_BASE}/project/${encodeURIComponent(slug)}/version`;
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Przekroczono limit zapytań do Modrinth.");
    }
    throw new Error(`Błąd API: ${response.status}`);
  }

  let data: ModrinthVersion[] = await response.json();

  // Filter by loaders
  if (options?.loaders && options.loaders.length > 0) {
    data = data.filter((v) =>
      options.loaders!.some((l) => v.loaders.includes(l)),
    );
  }

  // Filter by game versions
  if (options?.gameVersions && options.gameVersions.length > 0) {
    data = data.filter((v) =>
      options.gameVersions!.some((gv) => v.game_versions.includes(gv)),
    );
  }

  // Sort: newest first
  data.sort(
    (a, b) =>
      new Date(b.date_published).getTime() - new Date(a.date_published).getTime(),
  );

  setCache(versionsCache, cacheKey, data);
  return data;
}

/**
 * Format download count to human-readable string.
 */
export function formatDownloads(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}
