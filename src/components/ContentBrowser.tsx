import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useModSearch } from "@/hooks/useModSearch";
import { getProject, getProjectVersions, formatDownloads } from "@/lib/modrinth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import * as contentApi from "@/lib/content-installer";
import type { ModrinthSearchHit, ModrinthProject, ModrinthVersion } from "@/types/modrinth";

// ─── Helpers ────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

// ─── ContentDetails Panel ──────────────────────────────────────────

interface ContentDetailsProps {
  slug: string;
  projectType: string;
  instanceName: string;
  folder: "resourcepacks" | "shaderpacks";
  onBack: () => void;
  onInstalled: () => void;
}

function ContentDetails({ slug, projectType, instanceName, folder, onBack, onInstalled }: ContentDetailsProps) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullBody, setShowFullBody] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // For resourcepacks/shaderpacks, don't filter by loader
        const [proj, vers] = await Promise.all([
          getProject(slug),
          getProjectVersions(slug, {
            gameVersions: undefined,
          }),
        ]);
        if (!cancelled) {
          setProject(proj);
          setVersions(vers);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("content.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  // Reset selected version when versions change
  useEffect(() => {
    setSelectedVersionIdx(0);
  }, [versions]);

  const handleInstall = useCallback(async () => {
    const selectedVersion = versions[selectedVersionIdx];
    if (!selectedVersion) return;

    const primaryFile = selectedVersion.files.find((f) => f.primary) ?? selectedVersion.files[0];
    if (!primaryFile) return;

    setInstalling(true);
    try {
      await contentApi.installContent(
        instanceName,
        folder,
        primaryFile.filename,
        primaryFile.url,
        project?.title ?? null,
        selectedVersion.id,
        selectedVersion.version_number,
        project?.slug ?? null,
        project?.icon_url ?? null,
      );
      onInstalled();
      onBack();
    } catch (err) {
      console.error("Install failed:", err);
    } finally {
      setInstalling(false);
    }
  }, [versions, selectedVersionIdx, instanceName, folder, project, onInstalled, onBack]);

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
        <p className="text-sm text-destructive">{error || t("modDetails.notFound")}</p>
        <Button variant="ghost" size="sm" onClick={onBack}>{t("modDetails.backToResults")}</Button>
      </div>
    );
  }

  const selectedVersion = versions[selectedVersionIdx] ?? versions.find(
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
        {t("modDetails.backToResults")}
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
          </div>
          <p className="text-sm text-muted-foreground">
            {project.author} · {formatDownloads(project.downloads)} {t("modDetails.downloads")}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {project.loaders.slice(0, 3).map((l) => (
              <span key={l} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("modDetails.description")}</h3>
        <div
          className={cn(
            "prose prose-sm prose-invert max-w-none text-sm text-muted-foreground",
            !showFullBody && "line-clamp-6",
          )}
        >
          {project.body.replace(/<[^>]*>/g, "")}
        </div>
        {project.body.length > 500 && (
          <button
            onClick={() => setShowFullBody(!showFullBody)}
            className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showFullBody ? t("modDetails.showLess") : t("modDetails.showMore")}
          </button>
        )}
      </div>

      {/* Select version + install */}
      {selectedVersion && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("modDetails.selectVersion")}
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={selectedVersionIdx}
              onChange={(e) => setSelectedVersionIdx(Number(e.target.value))}
              className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-2 text-xs outline-none focus:border-ring"
            >
              {versions.map((v, i) => (
                <option key={v.id} value={i}>
                  {v.version_number}
                  {v.version_type !== "release" ? ` (${v.version_type})` : ""}
                  {" — "}{v.name}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={handleInstall}
              disabled={installing || !selectedVersion}
              className="shrink-0 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
            >
              {installing ? (
                <>
                  <div className="h-3 w-3 mr-1.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {t("content.installing")}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t("content.install")}
                </>
              )}
            </Button>
          </div>
          {/* Selected version details */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{selectedVersion.version_number}</span>
            <span>{selectedVersion.loaders.join(", ")}</span>
            <span>{selectedVersion.game_versions.join(", ")}</span>
            <span>{formatDownloads(selectedVersion.downloads)} {t("modDetails.downloads")}</span>
            {selectedVersion.version_type !== "release" && (
              <span className={cn("uppercase font-medium", selectedVersion.version_type === "beta" ? "text-amber-400" : "text-red-400")}>
                {selectedVersion.version_type}
              </span>
            )}
          </div>
        </div>
      )}

      {/* All versions list */}
      {versions.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("modDetails.allVersions", { count: versions.length })}
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
        <a
          href={`https://modrinth.com/${projectType}/${project.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-purple-400 hover:text-purple-300 hover:border-purple-500/30 hover:bg-purple-500/5 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {t("modDetails.modrinth")}
        </a>
        {project.source_url && (
          <a href={project.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {t("modDetails.source")}
          </a>
        )}
        {project.discord_url && (
          <a href={project.discord_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            {t("modDetails.discord")}
          </a>
        )}
      </div>
    </div>
  );
}

// ─── ContentSearchResult Card ───────────────────────────────────────

interface ContentSearchResultProps {
  hit: ModrinthSearchHit;
  onSelect: (slug: string) => void;
}

function ContentSearchResult({ hit, onSelect }: ContentSearchResultProps) {
  const { t } = useTranslation();
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
        <h3 className="text-sm font-medium truncate">{hit.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {truncate(hit.description, 120)}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{hit.author}</span>
          <span>{formatDownloads(hit.downloads)} {t("modDetails.downloads")}</span>
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

// ─── Main ContentBrowser Component ─────────────────────────────────

interface ContentBrowserProps {
  projectType: string;
  placeholder: string;
  instanceName: string;
  folder: "resourcepacks" | "shaderpacks";
  onInstalled: () => void;
}

function ContentBrowser({ projectType, placeholder, instanceName, folder, onInstalled }: ContentBrowserProps) {
  const { t } = useTranslation();
  const {
    results,
    loading,
    error,
    totalHits,
    hasMore,
    filters,
    setFilter,
    loadMore,
  } = useModSearch({ projectType });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Detail view
  if (selectedSlug) {
    return (
      <ContentDetails
        slug={selectedSlug}
        projectType={projectType}
        instanceName={instanceName}
        folder={folder}
        onBack={() => setSelectedSlug(null)}
        onInstalled={onInstalled}
      />
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
            placeholder={placeholder}
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

      {/* Results info */}
      {!loading && !error && results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("search.resultsFor", { count: totalHits, query: filters.query })}
        </p>
      )}

      {/* Results */}
      <div className="space-y-2">
        {results.map((hit) => (
          <ContentSearchResult
            key={hit.project_id}
            hit={hit}
            onSelect={(slug) => setSelectedSlug(slug)}
          />
        ))}
      </div>

      {/* Load more sentinel */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMore}
            className="text-xs text-muted-foreground"
          >
            {t("content.loadMore")}
          </Button>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
            <p className="text-xs text-muted-foreground">{t("content.searching")}</p>
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
              <p className="text-xs font-medium text-destructive">{t("search.error")}</p>
              <p className="mt-0.5 text-xs text-destructive/80">{error}</p>
            </div>
            <button onClick={() => setFilter("query", filters.query)} className="rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/20 transition-colors">
              {t("search.retry")}
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
          <p className="text-sm text-muted-foreground">{t("search.noResults", { query: filters.query })}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.noResultsHint")}</p>
        </div>
      )}

      {/* Initial empty state */}
      {!loading && !error && !filters.query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">{placeholder}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.startHintSub")}</p>
        </div>
      )}
    </div>
  );
}

export default ContentBrowser;
