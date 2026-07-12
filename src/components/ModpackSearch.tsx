import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useModSearch } from "@/hooks/useModSearch";
import { getProject, getProjectVersions, formatDownloads } from "@/lib/modrinth";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ModrinthSearchHit, ModrinthProject, ModrinthVersion } from "@/types/modrinth";

// ─── ModpackSearchResult Card ───────────────────────────────────────

interface ModpackSearchResultProps {
  hit: ModrinthSearchHit;
  onSelect: (hit: ModrinthSearchHit) => void;
}

function ModpackSearchResult({ hit, onSelect }: ModpackSearchResultProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-3 transition-all hover:border-primary/30 hover:bg-primary/5">
      {/* Icon */}
      {hit.icon_url ? (
        <img
          src={hit.icon_url}
          alt={hit.title}
          className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          loading="lazy"
        />
      ) : (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-border/50">
          <span className="text-sm font-bold text-primary">
            {hit.title.charAt(0)}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium truncate">{hit.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {hit.description}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{hit.author}</span>
          <span>{formatDownloads(hit.downloads)} {t("modDetails.downloads")}</span>
          <span className="flex items-center gap-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {hit.follows}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {hit.versions.slice(0, 3).map((v) => (
            <span key={v} className="rounded bg-muted/80 px-1 py-0.5 text-[9px] text-muted-foreground">{v}</span>
          ))}
          {hit.versions.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{hit.versions.length - 3}</span>
          )}
        </div>
      </div>

      {/* Select button */}
      <Button
        size="sm"
        onClick={() => onSelect(hit)}
        className="shrink-0 mt-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/80 hover:to-primary text-white shadow-lg shadow-primary/20 text-xs"
      >
        {t("modpackSearch.select")}
      </Button>
    </div>
  );
}

// ─── Selected Modpack Details ───────────────────────────────────────

interface SelectedModpackViewProps {
  hit: ModrinthSearchHit;
  selectedVersion: ModrinthVersion | null;
  versions: ModrinthVersion[];
  loadingVersions: boolean;
  onVersionChange: (version: ModrinthVersion) => void;
  onBack: () => void;
}

function SelectedModpackView({
  hit,
  selectedVersion,
  versions,
  loadingVersions,
  onVersionChange,
  onBack,
}: SelectedModpackViewProps) {
  const { t } = useTranslation();
  // Extract MC version and loader from dependencies
  const mcVersion = selectedVersion?.game_versions[0] ?? "—";
  const loader = selectedVersion?.loaders[0] ?? "fabric";

  // Full project data for description
  const [projectData, setProjectData] = useState<ModrinthProject | null>(null);
  const [loadingProject, setLoadingProject] = useState(true);
  const [showFullBody, setShowFullBody] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProject(true);
    setShowFullBody(false);

    getProject(hit.slug)
      .then((proj) => {
        if (!cancelled) {
          setProjectData(proj);
        }
      })
      .catch(() => {
        if (!cancelled) setProjectData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProject(false);
      });

    return () => { cancelled = true; };
  }, [hit.slug]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {t("modpackSearch.backToResults")}
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        {hit.icon_url ? (
          <img src={hit.icon_url} alt={hit.title} className="h-14 w-14 rounded-xl object-cover ring-1 ring-border/50" loading="lazy" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-border/50">
            <span className="text-xl font-bold text-primary">{hit.title.charAt(0)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{hit.title}</h2>
          <p className="text-sm text-muted-foreground">{hit.author} · {formatDownloads(hit.downloads)} {t("modDetails.downloads")}</p>
        </div>
      </div>

      {/* Description with HTML formatting */}
      {loadingProject ? (
        <div className="flex items-center gap-2 py-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <span className="text-xs text-muted-foreground">{t("content.loading")}</span>
        </div>
      ) : projectData?.body ? (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("modDetails.description")}</h3>
            {showFullBody && projectData.body.length > 500 && (
              <button
                type="button"
                onClick={() => setShowFullBody(false)}
                className="text-xs text-primary hover:text-primary transition-colors shrink-0 ml-2"
              >
                {t("modDetails.showLess")} ↑
              </button>
            )}
          </div>
          <div
            className={cn(
              "prose prose-sm prose-invert max-w-full text-sm text-muted-foreground description-render",
              !showFullBody && "line-clamp-6",
            )}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(projectData.body) }}
          />
          {projectData.body.length > 500 && (
            <button
              type="button"
              onClick={() => setShowFullBody(!showFullBody)}
              className="mt-2 text-xs text-primary hover:text-primary transition-colors"
            >
              {showFullBody ? t("modDetails.showLess") + " ↓" : t("modDetails.showMore") + " ↓"}
            </button>
          )}
        </div>
      ) : null}

      {/* Version selector */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("modDetails.selectVersion")}</h3>
        
        {loadingVersions ? (
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <span className="text-xs text-muted-foreground">{t("modpackSearch.loadingVersions")}</span>
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("modpackSearch.noVersions")}</p>
        ) : (
          <div className="flex items-center gap-3">
            <select
              value={selectedVersion?.id ?? ""}
              onChange={(e) => {
                const v = versions.find((ver) => ver.id === e.target.value);
                if (v) onVersionChange(v);
              }}
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-2 text-xs outline-none focus:border-ring"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_number}
                  {v.version_type !== "release" ? ` (${v.version_type})` : ""}
                  {" — "}{v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Info banner */}
      {selectedVersion && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-xs text-emerald-400/80">
              {t("modpackSearch.instanceCreatedWith", { mcVersion, loader, version: selectedVersion.version_number })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ModpackSearch Component ───────────────────────────────────

export interface ModpackSelection {
  modpackName: string;
  modpackUrl: string;
  modpackVersionId: string;
  modpackSummary?: string;
  modpackIconUrl?: string | null;
}

interface ModpackSearchProps {
  onSelect: (selection: ModpackSelection) => void;
}

function ModpackSearch({ onSelect }: ModpackSearchProps) {
  const { t } = useTranslation();
  const [searchLoader, setSearchLoader] = useState<"fabric" | "neoforge">("fabric");

  const {
    results,
    loading,
    error,
    totalHits,
    hasMore,
    filters,
    setFilter,
    loadMore,
  } = useModSearch({ projectType: "modpack", loader: searchLoader });

  const [selectedHit, setSelectedHit] = useState<ModrinthSearchHit | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load versions when a modpack is selected (respects searchLoader)
  useEffect(() => {
    const hit = selectedHit;
    if (!hit) return;

    let cancelled = false;
    setLoadingVersions(true);
    setVersions([]);
    setSelectedVersion(null);

    async function loadVersions() {
      try {
        const vers = await getProjectVersions((hit!).slug, {
          loaders: [searchLoader],
        });
        if (!cancelled) {
          // Filter to only modpack-type versions matching the selected loader
          const modpackVersions = vers.filter((v) =>
            v.loaders.includes(searchLoader),
          );

          setVersions(modpackVersions);
          if (modpackVersions.length > 0) {
            // Auto-select the latest release, or first version
            const release = modpackVersions.find((v) => v.version_type === "release")
              ?? modpackVersions[modpackVersions.length - 1]
              ?? modpackVersions[0];
            if (release) setSelectedVersion(release);
          }
        }
      } catch {
        if (!cancelled) {
          setVersions([]);
        }
      } finally {
        if (!cancelled) setLoadingVersions(false);
      }
    }

    loadVersions();
    return () => { cancelled = true; };
  }, [selectedHit, searchLoader]);

  // When selected version changes, notify parent
  useEffect(() => {
    if (!selectedHit || !selectedVersion) return;

    const primaryFile = selectedVersion.files.find((f) => f.primary)
      ?? selectedVersion.files[0];
    if (primaryFile) {
      onSelect({
        modpackName: selectedHit.title,
        modpackUrl: primaryFile.url,
        modpackVersionId: selectedVersion.id,
        modpackSummary: selectedHit.description,
        modpackIconUrl: selectedHit.icon_url,
      });
    }
  }, [selectedHit, selectedVersion, onSelect]);

  // Load more (pagination)
  useEffect(() => {
    if (!hasMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  // ── Detail view for selected modpack ─────────────────────────
  if (selectedHit) {
    return (
      <SelectedModpackView
        hit={selectedHit}
        selectedVersion={selectedVersion}
        versions={versions}
        loadingVersions={loadingVersions}
        onVersionChange={setSelectedVersion}
        onBack={() => {
          setSelectedHit(null);
          setSelectedVersion(null);
          setVersions([]);
        }}
      />
    );
  }

  // ── Search view ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder={t("modpackSearch.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {filters.query && (
            <button
              onClick={() => setFilter("query", "")}
              className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Loader filter */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border/50 bg-card/50 p-0.5">
          <button
            type="button"
            onClick={() => setSearchLoader("fabric")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              searchLoader === "fabric"
                ? "bg-amber-500/15 text-amber-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Fabric
          </button>
          <button
            type="button"
            onClick={() => setSearchLoader("neoforge")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              searchLoader === "neoforge"
                ? "bg-sky-500/15 text-sky-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            NeoForge
          </button>
        </div>
        <p className="text-xs text-muted-foreground/60">
          {searchLoader === "fabric"
            ? t("modpackSearch.fabricOnly")
            : t("modpackSearch.neoforgeOnly")}
        </p>
      </div>

      {/* Results info */}
      {!loading && !error && results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("search.resultsFor", { count: totalHits, query: filters.query })}
        </p>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((hit) => (
          <ModpackSearchResult
            key={hit.project_id}
            hit={hit}
            onSelect={(h) => setSelectedHit(h)}
          />
        ))}
      </div>

      {/* Load more sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-xs text-muted-foreground">{t("search.loading")}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !filters.query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">{t("modpackSearch.startHint")}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.startHintSub")}</p>
        </div>
      )}

      {/* No results for query */}
      {!loading && !error && results.length === 0 && filters.query && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-muted-foreground">{t("search.noResults", { query: filters.query })}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.noResultsHint")}</p>
        </div>
      )}
    </div>
  );
}

export default ModpackSearch;
