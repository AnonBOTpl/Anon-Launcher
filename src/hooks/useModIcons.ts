import { useState, useEffect, useRef } from "react";
import { searchMods } from "@/lib/modrinth";

/**
 * Global in-memory cache for mod icons fetched from Modrinth.
 * Key: normalized search query, Value: icon URL or null if not found.
 */
const iconCache = new Map<string, string | null>();

/**
 * Generate search queries to try for a given mod name and file name.
 * Tries progressively broader queries to find the best match.
 */
function generateSearchQueries(name: string, fileName: string): string[] {
  const queries: string[] = [];
  const trimmed = name.trim();

  // 1. Try the full name as-is
  if (trimmed) queries.push(trimmed);

  // 2. Try stripping trailing version-like words (e.g. "Sodium 0.6.0" → "Sodium")
  const words = trimmed.split(/\s+/);
  const meaningfulWords = words.filter(
    (w) => !/^\d/.test(w) && !/^(mc|fabric|forge|quilt|neoforge)$/i.test(w),
  );
  if (meaningfulWords.length > 0 && meaningfulWords.length < words.length) {
    queries.push(meaningfulWords.join(" "));
  }

  // 3. Try just the first word (usually the mod name)
  if (words.length > 1 && words[0]) {
    queries.push(words[0]);
  }

  // 4. Try extracting a clean name from the filename
  //    e.g. "sodium-fabric-0.6.0.jar" → "sodium"
  const stem = fileName
    .replace(/\.jar(\.disabled)?$/, "")
    .replace(/[-_]/g, " ");
  const stemWords = stem.split(/\s+/);
  const cleanStemWords = stemWords.filter(
    (w) =>
      !/^\d/.test(w) && !/^(mc|fabric|forge|quilt|neoforge|vanilla)$/i.test(w),
  );
  const cleanJoined = cleanStemWords.join(" ").toLowerCase();
  if (cleanStemWords.length > 0 && cleanJoined !== trimmed.toLowerCase()) {
    queries.push(cleanStemWords.slice(0, 2).join(" "));
    if (cleanStemWords[0]) {
      queries.push(cleanStemWords[0]);
    }
  }

  // Deduplicate while preserving order, filter empty
  return [...new Set(queries.map((q) => q.toLowerCase().trim()))].filter(
    (q) => q.length > 0,
  );
}

/**
 * Fetch a mod's icon from Modrinth by trying multiple search strategies.
 * Uses a global cache to avoid duplicate/redundant API calls.
 */
async function fetchIconFromModrinth(
  name: string,
  fileName: string,
): Promise<string | null> {
  const queries = generateSearchQueries(name, fileName);

  for (const query of queries) {
    if (iconCache.has(query)) {
      const cached = iconCache.get(query);
      if (cached) return cached;
      continue;
    }

    try {
      const result = await searchMods({ query, limit: 3 });

      const exact = result.hits.find(
        (h) => h.title.toLowerCase() === query,
      );
      const hit = exact ?? result.hits[0];

      if (hit?.icon_url) {
        iconCache.set(query, hit.icon_url);
        iconCache.set(name.toLowerCase().trim(), hit.icon_url);
        iconCache.set(fileName.toLowerCase(), hit.icon_url);
        return hit.icon_url;
      }

      iconCache.set(query, null);
    } catch {
      iconCache.set(query, null);
    }
  }

  iconCache.set(name.toLowerCase().trim(), null);
  return null;
}

/**
 * Hook that lazily fetches icons from Modrinth for mods that don't have one.
 * Returns a map of fileName → icon URL (or null if not found).
 *
 * Skips fetching if all relevant mods already have entries in the map
 * (to avoid unnecessary work when useMods polling triggers re-renders).
 */
export function useModIcons(
  mods: Array<{ name: string; fileName: string; iconUrl?: string | null }>,
): Map<string, string | null> {
  const [iconMap, setIconMap] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const modsNeedingIcons = mods.filter(
      (m) => !m.iconUrl && m.name.trim().length > 0,
    );
    if (modsNeedingIcons.length === 0) return;

    // Skip if all mods without iconUrl already have entries in our map
    const allDone = modsNeedingIcons.every((m) =>
      fetchedRef.current.has(m.fileName),
    );
    if (allDone) return;

    let cancelled = false;

    async function fetchAll() {
      const results = new Map<string, string | null>();

      for (const mod of modsNeedingIcons) {
        if (cancelled) return;
        const url = await fetchIconFromModrinth(mod.name, mod.fileName);
        if (cancelled) return;
        results.set(mod.fileName, url);
        fetchedRef.current.add(mod.fileName);
        await new Promise((r) => setTimeout(r, 400));
      }

      if (cancelled) return;

      setIconMap((prev) => {
        // Only update if results actually changed
        let changed = false;
        for (const [k, v] of results) {
          if (prev.get(k) !== v) {
            changed = true;
            break;
          }
        }
        return changed ? results : prev;
      });
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [mods]);

  return iconMap;
}
