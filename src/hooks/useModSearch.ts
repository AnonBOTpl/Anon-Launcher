import { useState, useEffect, useCallback, useRef } from "react";
import { searchMods } from "@/lib/modrinth";
import type { ModrinthSearchHit, ModrinthSortIndex } from "@/types/modrinth";

export interface ModSearchFilters {
  query: string;
  mcVersion?: string;
  loader: string;
  category?: string;
  sort: ModrinthSortIndex;
}

export interface ModSearchState {
  results: ModrinthSearchHit[];
  loading: boolean;
  error: string | null;
  totalHits: number;
  offset: number;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

export function useModSearch(initialFilters?: Partial<ModSearchFilters>) {
  const [filters, setFilters] = useState<ModSearchFilters>({
    query: "",
    mcVersion: initialFilters?.mcVersion,
    loader: initialFilters?.loader ?? "fabric",
    category: initialFilters?.category,
    sort: initialFilters?.sort ?? "relevance",
  });

  const [state, setState] = useState<ModSearchState>({
    results: [],
    loading: false,
    error: null,
    totalHits: 0,
    offset: 0,
    hasMore: true,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const doSearch = useCallback(
    async (searchFilters: ModSearchFilters, offset: number, append: boolean) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const facets: string[][] = [];

        // Filter by project type (mods only)
        facets.push(["project_type:mod"]);

        // Filter by loader
        if (searchFilters.loader) {
          facets.push([`categories:${searchFilters.loader}`]);
        }

        // Filter by category
        if (searchFilters.category) {
          facets.push([`categories:${searchFilters.category}`]);
        }

        // Filter by Minecraft version
        if (searchFilters.mcVersion) {
          facets.push([`versions:${searchFilters.mcVersion}`]);
        }

        const result = await searchMods({
          query: searchFilters.query,
          facets,
          index: searchFilters.sort,
          limit: DEFAULT_LIMIT,
          offset,
        });

        if (controller.signal.aborted) return;

        setState((prev) => {
          // Deduplicate by project_id when appending (stale closures can cause duplicates)
          const newResults = append
            ? (() => {
                const existingIds = new Set(prev.results.map((r) => r.project_id));
                const uniqueNew = result.hits.filter(
                  (h) => !existingIds.has(h.project_id),
                );
                return [...prev.results, ...uniqueNew];
              })()
            : result.hits;

          return {
            results: newResults,
            loading: false,
            error: null,
            totalHits: result.total_hits,
            offset: offset + result.hits.length,
            hasMore: offset + result.hits.length < result.total_hits,
          };
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError" || controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Wystąpił nieznany błąd";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      }
    },
    [],
  );

  // Trigger search when filters change (with debounce for query)
  useEffect(() => {
    // Skip the initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Still load initial results if there's a query
      if (!filters.query && !filters.mcVersion) return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      doSearch(filters, 0, false);
    }, filters.query ? 400 : 0);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filters, doSearch]);

  // Update a single filter
  const setFilter = useCallback(
    <K extends keyof ModSearchFilters>(key: K, value: ModSearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Load more (pagination)
  const loadMore = useCallback(() => {
    if (state.loading || !state.hasMore) return;
    doSearch(filters, state.offset, true);
  }, [state.loading, state.hasMore, state.offset, filters, doSearch]);

  // Refresh with current filters
  const refresh = useCallback(() => {
    doSearch(filters, 0, false);
  }, [filters, doSearch]);

  return {
    ...state,
    filters,
    setFilter,
    loadMore,
    refresh,
  };
}
