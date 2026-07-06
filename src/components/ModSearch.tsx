import { useState, useRef, useEffect } from "react";
import { useModSearch } from "@/hooks/useModSearch";
import { getProject, getProjectVersions, formatDownloads } from "@/lib/modrinth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ModrinthSearchHit, ModrinthProject, ModrinthVersion } from "@/types/modrinth";

// ─── Helpers ────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function getLoaderColor(loader: string): string {
  return loader === "fabric" ? "text-emerald-400" : "text-muted-foreground";
}

// ─── ModDetails Panel ──────────────────────────────────────────────

interface ModDetailsProps {
  slug: string;
  mcVersion?: string;
  onBack: () => void;
  isInstalled?: boolean;
  onInstall?: (versionId: string, downloadUrl: string, fileName: string, modName: string, projectSlug?: string, iconUrl?: string | null) => Promise<void>;
  onUninstall?: () => Promise<void>;
}

function ModDetails({ slug, mcVersion, onBack, isInstalled, onInstall, onUninstall }: ModDetailsProps) {
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullBody, setShowFullBody] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [proj, vers] = await Promise.all([
          getProject(slug),
          getProjectVersions(slug, {
            loaders: ["fabric"],
            gameVersions: mcVersion ? [mcVersion] : undefined,
          }),
        ]);
        if (!cancelled) {
          setProject(proj);
          setVersions(vers);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Nie udało się załadować szczegółów.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error || "Nie znaleziono projektu."}</p>
        <Button variant="ghost" size="sm" onClick={onBack}>Powrót do wyników</Button>
      </div>
    );
  }

  // Pick latest release version (already filtered by fabric + mcVersion via API)
  const latestVersion = versions.find(
    (v) => v.version_type === "release",
  ) ?? versions[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Powrót do wyników
      </button>

      {/* Header */}
      <div className="flex items-start gap-4">
        {project.icon_url ? (
          <img
            src={project.icon_url}
            alt={project.title}
            className="h-16 w-16 rounded-xl object-cover ring-1 ring-border/50"
            loading="lazy"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600/20 to-purple-600/5 ring-1 ring-border/50">
            <span className="text-2xl font-bold text-purple-400">
              {project.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold truncate">{project.title}</h2>
            {isInstalled && (
              <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                Zainstalowany
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.author} · {formatDownloads(project.downloads)} pobrań
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {project.loaders.map((l) => (
              <span key={l} className={cn("text-[10px] font-medium uppercase tracking-wider", getLoaderColor(l))}>
                {l}
              </span>
            ))}
            {project.game_versions.slice(0, 3).map((v) => (
              <span key={v} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {v}
              </span>
            ))}
            {project.game_versions.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{project.game_versions.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opis</h3>
        </div>
        <div
          className={cn(
            "prose prose-sm prose-invert max-w-none text-sm text-muted-foreground",
            !showFullBody && "line-clamp-6",
          )}
        >
          {/* Strip HTML tags for a simple view */}
          {project.body.replace(/<[^>]*>/g, "")}
        </div>
        {project.body.length > 500 && (
          <button
            onClick={() => setShowFullBody(!showFullBody)}
            className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showFullBody ? "Pokaż mniej" : "Pokaż więcej"}
          </button>
        )}
      </div>

      {/* Latest version */}
      {latestVersion && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Najnowsza wersja
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{latestVersion.name}</p>
              <p className="text-xs text-muted-foreground">
                {latestVersion.version_number} · {latestVersion.loaders.join(", ")} · {latestVersion.game_versions.join(", ")}
              </p>
            </div>
            {isInstalled ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (!onUninstall) return;
                  setUninstalling(true);
                  try {
                    await onUninstall();
                  } finally {
                    setUninstalling(false);
                  }
                }}
                disabled={!onUninstall || uninstalling}
                className="shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                {uninstalling ? "..." : "Odinstaluj"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  if (onInstall && latestVersion) {
                    const primaryFile = latestVersion.files.find((f) => f.primary) ?? latestVersion.files[0];
                    if (primaryFile) {
                      onInstall(
                        latestVersion.id,
                        primaryFile.url,
                        primaryFile.filename,
                        project.title,
                        project.slug,
                        project.icon_url,
                      );
                    }
                  }
                }}
                disabled={!onInstall || !latestVersion}
                className="shrink-0 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Zainstaluj
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Dependencies */}
      {latestVersion && latestVersion.dependencies.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Zależności
          </h3>
          <div className="space-y-1.5">
            {latestVersion.dependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {dep.dependency_type === "required" && (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive font-medium">Wymagane</span>
                )}
                {dep.dependency_type === "optional" && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium">Opcjonalne</span>
                )}
                {dep.dependency_type === "incompatible" && (
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 font-medium">Niezgodne</span>
                )}
                <span className="text-muted-foreground">{dep.project_id ?? dep.file_name ?? "Nieznane"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All versions list */}
      {versions.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Wszystkie wersje ({versions.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{v.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {v.version_number}
                    {v.version_type !== "release" && (
                      <span className={cn("ml-1.5 uppercase text-[10px]", v.version_type === "beta" ? "text-amber-400" : "text-red-400")}>
                        {v.version_type}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {formatDownloads(v.downloads)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {project.source_url && (
          <a href={project.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Source
          </a>
        )}
        {project.discord_url && (
          <a href={project.discord_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Discord
          </a>
        )}
        {project.wiki_url && (
          <a href={project.wiki_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Wiki
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ModSearchResult Card ──────────────────────────────────────────

interface ModSearchResultProps {
  hit: ModrinthSearchHit;
  isInstalled?: boolean;
  onSelect: (slug: string) => void;
}

function ModSearchResult({ hit, isInstalled, onSelect }: ModSearchResultProps) {
  // Determine main loader from categories
  const mainLoader = hit.categories.includes("fabric") ? "fabric" : null;

  return (
    <button
      onClick={() => onSelect(hit.slug)}
      className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-3 text-left transition-all hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-sm hover:shadow-purple-500/5"
    >
      {/* Icon */}
      {hit.icon_url ? (
        <img
          src={hit.icon_url}
          alt={hit.title}
          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          loading="lazy"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600/20 to-purple-600/5 ring-1 ring-border/50">
          <span className="text-sm font-bold text-purple-400">
            {hit.title.charAt(0)}
          </span>
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium truncate">{hit.title}</h3>
          {isInstalled && (
            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              Zainstalowany
            </span>
          )}
          {mainLoader && (
            <span className={cn("shrink-0 text-[10px] font-medium uppercase tracking-wider", getLoaderColor(mainLoader))}>
              {mainLoader}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {truncate(hit.description, 120)}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{hit.author}</span>
          <span>{formatDownloads(hit.downloads)} pobrań</span>
          <span className="flex items-center gap-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {hit.follows}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {hit.versions.slice(0, 3).map((v) => (
            <span key={v} className="rounded bg-muted/80 px-1 py-0.5 text-[9px] text-muted-foreground">
              {v}
            </span>
          ))}
          {hit.versions.length > 3 && (
            <span className="text-[9px] text-muted-foreground">
              +{hit.versions.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-2 shrink-0 text-muted-foreground"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

// ─── Filter Bar ─────────────────────────────────────────────────────

interface FilterBarProps {
  mcVersion?: string;
  sort: string;
  onMcVersionChange: (v: string | undefined) => void;
  onSortChange: (s: string) => void;
}

const SORT_OPTIONS = [
  { id: "relevance", label: "Trafność" },
  { id: "downloads", label: "Pobrania" },
  { id: "follows", label: "Obserwowane" },
  { id: "newest", label: "Najnowsze" },
  { id: "updated", label: "Aktualizowane" },
];

function FilterBar({ mcVersion, sort, onMcVersionChange, onSortChange }: FilterBarProps) {
  const [showMcInput, setShowMcInput] = useState(false);
  const [mcInput, setMcInput] = useState(mcVersion ?? "");

  const handleMcApply = () => {
    onMcVersionChange(mcInput || undefined);
    setShowMcInput(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Fabric badge — always Fabric */}
      <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
        Fabric
      </span>

      {/* MC version filter */}
      {showMcInput ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={mcInput}
            onChange={(e) => setMcInput(e.target.value)}
            placeholder="Np. 1.21"
            className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring"
            onKeyDown={(e) => { if (e.key === "Enter") handleMcApply(); if (e.key === "Escape") setShowMcInput(false); }}
            autoFocus
          />
          <button onClick={handleMcApply} className="rounded-md bg-purple-600 px-2 py-1 text-[10px] text-white hover:bg-purple-500 transition-colors">OK</button>
        </div>
      ) : (
        <button
          onClick={() => setShowMcInput(true)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            mcVersion
              ? "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {mcVersion ? `MC ${mcVersion}` : "MC"}
        </button>
      )}

      {/* Sort dropdown */}
      <div className="ml-auto">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-ring"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Main ModSearch Component ─────────────────────────────────────

interface ModSearchProps {
  instanceMcVersion?: string;
  installedMods?: { name: string; fileName: string }[];
  onInstall?: (versionId: string, downloadUrl: string, fileName: string, modName: string, projectSlug?: string, iconUrl?: string | null) => Promise<void>;
  onUninstall?: (fileName: string) => Promise<void>;
}

function ModSearch({ instanceMcVersion, installedMods, onInstall, onUninstall }: ModSearchProps) {
  const {
    results,
    loading,
    error,
    totalHits,
    hasMore,
    filters,
    setFilter,
    loadMore,
  } = useModSearch({ mcVersion: instanceMcVersion });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
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

  // Determine if selected mod is installed
  const selectedHit = results.find((h) => h.slug === selectedSlug);
  const installedMod = selectedHit
    ? installedMods?.find((m) => m.name === selectedHit.title)
    : undefined;

  // Detail view
  if (selectedSlug) {
    return (
      <div>
        <ModDetails
          slug={selectedSlug}
          mcVersion={instanceMcVersion}
          isInstalled={!!installedMod}
          onBack={() => setSelectedSlug(null)}
          onInstall={onInstall}
          onUninstall={
            installedMod && onUninstall
              ? () => onUninstall(installedMod.fileName)
              : undefined
          }
        />
      </div>
    );
  }

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
            placeholder="Szukaj modyfikacji..."
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

      {/* Filters */}
      <FilterBar
        mcVersion={filters.mcVersion}
        sort={filters.sort}
        onMcVersionChange={(v) => setFilter("mcVersion", v)}
        onSortChange={(s) => setFilter("sort", s as "relevance" | "downloads" | "follows" | "newest" | "updated")}
      />

      {/* Results info */}
      {!loading && !error && results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Znaleziono {totalHits} modów
          {filters.query && <> dla "<span className="text-foreground">{filters.query}</span>"</>}
        </p>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((hit) => (
          <ModSearchResult
            key={hit.project_id}
            hit={hit}
            isInstalled={installedMods?.some((m) => m.name === hit.title)}
            onSelect={(slug) => setSelectedSlug(slug)}
          />
        ))}
      </div>

      {/* Load more sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
            <p className="text-xs text-muted-foreground">Szukanie modów...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-destructive">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-destructive">Błąd Modrinth</p>
              <p className="mt-0.5 text-xs text-destructive/80">{error}</p>
            </div>
            <button onClick={() => setFilter("query", filters.query)} className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/20 transition-colors">
              Spróbuj ponownie
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && filters.query && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-muted-foreground">Brak wyników dla "<span className="text-foreground">{filters.query}</span>"</p>
          <p className="text-xs text-muted-foreground/60">Spróbuj innego zapytania lub zmień filtry</p>
        </div>
      )}

      {/* Initial empty state */}
      {!loading && !error && !filters.query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">Wpisz nazwę moda, aby rozpocząć wyszukiwanie</p>
          <p className="text-xs text-muted-foreground/60">Dostępne przez API Modrinth</p>
        </div>
      )}
    </div>
  );
}

export default ModSearch;
