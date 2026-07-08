import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useModSearch } from "@/hooks/useModSearch";
import { getProject, getProjectVersions, formatDownloads } from "@/lib/modrinth";
import { checkModDependencies } from "@/lib/dependency-resolver";
import * as modApi from "@/lib/mod-installer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import MissingDepsWarning from "@/components/MissingDepsWarning";
import type { ModrinthSearchHit, ModrinthProject, ModrinthVersion } from "@/types/modrinth";

// ─── Helpers ────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

function getLoaderColor(loader: string): string {
  return loader === "fabric" ? "text-emerald-400" : "text-muted-foreground";
}

// ─── HTML Sanitizer ─────────────────────────────────────────────────

/**
 * Basic HTML sanitizer — zezwala tylko na bezpieczne tagi formatujące.
 * Modrinth API zwraca body jako HTML (z Modrinth Flavored Markdown).
 */
function sanitizeHtml(html: string): string {
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(html);
  if (!hasHtmlTags) {
    return html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
  }

  const allowlist = [
    "p", "br", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "strong", "em", "b", "i", "u", "s",
    "a",
    "pre", "code", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "img",
    "div", "span",
    "sub", "sup",
  ];

  let cleaned = html;
  cleaned = cleaned.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  cleaned = cleaned.replace(
    /(href|src)\s*=\s*(?:"(?!https?:\/\/|\/|#)[^"]*"|'(?!https?:\/\/|\/|#)[^']*')/gi,
    "$1=''"
  );
  cleaned = cleaned.replace(/href\s*=\s*"\s*javascript:[^"]*"/gi, 'href=""');
  cleaned = cleaned.replace(/href\s*=\s*'\s*javascript:[^']*'/gi, "href=''");
  cleaned = cleaned.replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tagName) => {
    const lower = tagName.toLowerCase();
    if (allowlist.includes(lower)) return match;
    return "";
  });

  return cleaned;
}

// ─── ModDetails Panel ──────────────────────────────────────────────

interface ModDetailsProps {
  slug: string;
  instanceName: string;
  mcVersion?: string;
  onBack: () => void;
  isInstalled?: boolean;
  onUpdated?: () => void;
}

function ModDetails({ slug, instanceName, mcVersion, onBack, isInstalled, onUpdated }: ModDetailsProps) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullBody, setShowFullBody] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Dependency panel state
  const [depState, setDepState] = useState<{
    visible: boolean;
    loading: boolean;
    installing: boolean;
    deps: any[];
    hasMissing: boolean;
    hasConflicts: boolean;
  }>({ visible: false, loading: false, installing: false, deps: [], hasMissing: false, hasConflicts: false });

  // Scroll to top of description when expanding
  const handleToggleDescription = () => {
    setShowFullBody((prev) => {
      if (!prev) {
        requestAnimationFrame(() => {
          descriptionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return !prev;
    });
  };

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
          setError(err instanceof Error ? err.message : t("modDetails.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, mcVersion]);

  useEffect(() => {
    setSelectedVersionIdx(0);
  }, [versions]);

  // ─── Compute selectedVersion (safe to call before early returns) ──
  const selectedVersion = versions[selectedVersionIdx] ?? versions.find(
    (v) => v.version_type === "release",
  ) ?? versions[0];

  // ─── Install flow hooks (MUST be before early returns) ─────────

  const handleInstallSelected = useCallback(async () => {
    if (!selectedVersion) return;
    const primaryFile = selectedVersion.files.find((f) => f.primary) ?? selectedVersion.files[0];
    if (!primaryFile) return;

    const projectVal = project;
    if (!projectVal) return;

    const deps = selectedVersion.dependencies;
    if (!deps || deps.length === 0) {
      try {
        await modApi.installMod(
          instanceName,
          selectedVersion.id,
          selectedVersion.version_number,
          primaryFile.url,
          primaryFile.filename,
          projectVal.title,
          projectVal.slug,
          projectVal.icon_url,
        );
        onUpdated?.();
      } catch (err) {
        console.error("Install failed:", err);
      }
      return;
    }

    setDepState({ visible: true, loading: true, installing: false, deps: [], hasMissing: false, hasConflicts: false });
    try {
      const result = await checkModDependencies(instanceName, deps);
      const hasOptionalDeps = result.dependencies.some((d) => d.type === "optional" && !d.installed);

      if (!result.hasMissing && !result.hasConflicts && !hasOptionalDeps) {
        try {
          await modApi.installMod(
            instanceName,
            selectedVersion.id,
            selectedVersion.version_number,
            primaryFile.url,
            primaryFile.filename,
            projectVal.title,
            projectVal.slug,
            projectVal.icon_url,
          );
          setDepState({ visible: false, loading: false, installing: false, deps: [], hasMissing: false, hasConflicts: false });
          onUpdated?.();
        } catch (err) {
          console.error("Install failed:", err);
          setDepState((prev) => ({ ...prev, visible: false, loading: false }));
        }
        return;
      }

      setDepState({
        visible: true,
        loading: false,
        installing: false,
        deps: result.dependencies,
        hasMissing: result.hasMissing,
        hasConflicts: result.hasConflicts,
      });
    } catch {
      setDepState({ visible: false, loading: false, installing: false, deps: [], hasMissing: false, hasConflicts: false });
      try {
        await modApi.installMod(
          instanceName,
          selectedVersion.id,
          selectedVersion.version_number,
          primaryFile.url,
          primaryFile.filename,
          projectVal.title,
          projectVal.slug,
          projectVal.icon_url,
        );
        onUpdated?.();
      } catch (err) {
        console.error("Install failed:", err);
      }
    }
  }, [selectedVersion, instanceName, project, onUpdated, depState.deps]);

  const handleInstallDeps = useCallback(async (selectedOptionalIds: string[]) => {
    const primaryFile = selectedVersion?.files.find((f) => f.primary) ?? selectedVersion?.files[0];
    if (!selectedVersion || !primaryFile) return;

    const projectVal = project;
    if (!projectVal) return;

    setDepState((prev) => ({ ...prev, installing: true }));
    try {
      const depsToInstall = depState.deps.filter(
        (d: any) =>
          !d.installed &&
          d.projectId &&
          (d.type === "required" ||
            (d.type === "optional" && selectedOptionalIds.includes(d.projectId))),
      );

      for (const dep of depsToInstall) {
        try {
          const depProject = await getProject(dep.projectId);
          const depVersions = await getProjectVersions(depProject.slug, {
            loaders: ["fabric"],
            gameVersions: mcVersion ? [mcVersion] : undefined,
          });
          if (depVersions.length === 0) continue;
          const depVersion = (depVersions.find((v: any) => v.version_type === "release") ?? depVersions[0])!;
          const depFile = depVersion.files.find((f: any) => f.primary) ?? depVersion.files[0];
          if (!depFile) continue;

          await modApi.installMod(
            instanceName,
            depVersion.id,
            depVersion.version_number,
            depFile.url,
            depFile.filename,
            depProject.title,
            depProject.slug,
            depProject.icon_url,
          );
        } catch (depErr) {
          console.error("Failed to install dependency:", depErr);
        }
      }

      await modApi.installMod(
        instanceName,
        selectedVersion.id,
        selectedVersion.version_number,
        primaryFile.url,
        primaryFile.filename,
        projectVal.title,
        projectVal.slug,
        projectVal.icon_url,
      );

      setDepState({ visible: false, loading: false, installing: false, deps: [], hasMissing: false, hasConflicts: false });
      onUpdated?.();
    } catch (err) {
      console.error("Install failed:", err);
      setDepState((prev) => ({ ...prev, installing: false }));
    }
  }, [selectedVersion, depState.deps, instanceName, mcVersion, project, onUpdated]);

  const handleCancelDeps = useCallback(() => {
    setDepState({ visible: false, loading: false, installing: false, deps: [], hasMissing: false, hasConflicts: false });
  }, []);

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
            {isInstalled && (
              <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                {t("modDetails.installed")}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.author} · {formatDownloads(project.downloads)} {t("modDetails.downloads")}
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
      <div ref={descriptionRef} className="rounded-lg border border-border/50 bg-card/50 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("modDetails.description")}</h3>
          {showFullBody && project.body.length > 500 && (
            <button
              onClick={() => setShowFullBody(false)}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors shrink-0 ml-2"
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
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.body) }}
        />
        {project.body.length > 500 && (
          <button
            onClick={handleToggleDescription}
            className="mt-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {showFullBody ? t("modDetails.showLess") + " ↓" : t("modDetails.showMore") + " ↓"}
          </button>
        )}
      </div>

      {/* Select version + install */}
      {selectedVersion && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

            {isInstalled ? (
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  setUninstalling(true);
                  try {
                    await modApi.removeMod(instanceName, `${project.slug}.jar`);
                    onUpdated?.();
                  } catch (err) {
                    console.error("Uninstall failed:", err);
                  } finally {
                    setUninstalling(false);
                  }
                }}
                disabled={uninstalling}
                className="shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
                {uninstalling ? "..." : t("modDetails.uninstall")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleInstallSelected}
                disabled={!selectedVersion || depState.loading || depState.installing}
                className="shrink-0 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
              >
                {depState.loading || depState.installing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {t("modDetails.install")}
                  </>
                )}
              </Button>
            )}
          </div>
          {selectedVersion && selectedVersionIdx !== undefined && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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
          )}

          {/* Inline dependency panel — appears right here, no modal! */}
          {depState.visible && (
            <MissingDepsWarning
              dependencies={depState.deps}
              hasMissing={depState.hasMissing}
              hasConflicts={depState.hasConflicts}
              circularDetected={false}
              loading={depState.loading}
              installing={depState.installing}
              modName={project.title}
              onInstallDeps={handleInstallDeps}
              onCancel={handleCancelDeps}
            />
          )}
        </div>
      )}

      {/* Dependencies overview (read-only) */}
      {selectedVersion && selectedVersion.dependencies.length > 0 && !depState.visible && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("modDetails.dependencies")}
          </h3>
          <div className="space-y-1.5">
            {selectedVersion.dependencies.map((dep, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {dep.dependency_type === "required" && (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive font-medium">{t("modDetails.required")}</span>
                )}
                {dep.dependency_type === "optional" && (
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 font-medium">{t("modDetails.optional")}</span>
                )}
                {dep.dependency_type === "incompatible" && (
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400 font-medium">{t("modDetails.incompatible")}</span>
                )}
                <span className="text-muted-foreground">{dep.project_id ?? dep.file_name ?? t("common.unknown")}</span>
              </div>
            ))}
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
          href={`https://modrinth.com/mod/${project.slug}`}
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
        {project.wiki_url && (
          <a href={project.wiki_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            {t("modDetails.wiki")}
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
  const { t } = useTranslation();
  const mainLoader = hit.categories.includes("fabric") ? "fabric" : null;

  return (
    <button
      onClick={() => onSelect(hit.slug)}
      className="flex w-full items-start gap-3 rounded-xl border border-border/50 bg-card/50 p-3 text-left transition-all hover:border-purple-500/30 hover:bg-purple-500/5 hover:shadow-sm hover:shadow-purple-500/5"
    >
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
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium truncate">{hit.title}</h3>
          {isInstalled && (
            <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              {t("modDetails.installed")}
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
          <span>{formatDownloads(hit.downloads)} {t("modDetails.downloads")}</span>
          <span className="flex items-center gap-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            {hit.follows}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {hit.versions.slice(0, 3).map((v) => (
            <span key={v} className="rounded bg-muted/80 px-1 py-0.5 text-[9px] text-muted-foreground">{v}</span>
          ))}
          {hit.versions.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{hit.versions.length - 3}</span>
          )}
        </div>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-2 shrink-0 text-muted-foreground">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

// ─── Filter Bar ─────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "", labelKey: "search.allCategories" },
  { id: "technology", labelKey: "categories.technology" },
  { id: "optimization", labelKey: "categories.optimization" },
  { id: "adventure", labelKey: "categories.adventure" },
  { id: "magic", labelKey: "categories.magic" },
  { id: "combat", labelKey: "categories.combat" },
  { id: "worldgen", labelKey: "categories.worldgen" },
  { id: "storage", labelKey: "categories.storage" },
  { id: "utility", labelKey: "categories.utility" },
  { id: "decoration", labelKey: "categories.decoration" },
  { id: "food", labelKey: "categories.food" },
  { id: "game-mechanics", labelKey: "categories.gameMechanics" },
  { id: "library", labelKey: "categories.library" },
  { id: "mobs", labelKey: "categories.mobs" },
  { id: "social", labelKey: "categories.social" },
  { id: "transport", labelKey: "categories.transport" },
  { id: "cursed", labelKey: "categories.cursed" },
  { id: "misc", labelKey: "categories.misc" },
];

interface FilterBarProps {
  mcVersion?: string;
  category?: string;
  sort: string;
  onMcVersionChange: (v: string | undefined) => void;
  onCategoryChange: (c: string | undefined) => void;
  onSortChange: (s: string) => void;
}

const SORT_OPTIONS = [
  { id: "relevance", labelKey: "search.relevance" },
  { id: "downloads", labelKey: "search.downloads" },
  { id: "follows", labelKey: "search.follows" },
  { id: "newest", labelKey: "search.newest" },
  { id: "updated", labelKey: "search.updated" },
];

function FilterBar({ mcVersion, category, sort, onMcVersionChange, onCategoryChange, onSortChange }: FilterBarProps) {
  const { t } = useTranslation();
  const [showMcInput, setShowMcInput] = useState(false);
  const [mcInput, setMcInput] = useState(mcVersion ?? "");

  const handleMcApply = () => {
    onMcVersionChange(mcInput || undefined);
    setShowMcInput(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
        {t("search.fabric")}
      </span>
      {showMcInput ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={mcInput}
            onChange={(e) => setMcInput(e.target.value)}
            placeholder={t("search.mcPlaceholder")}
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
            mcVersion ? "bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/30" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {mcVersion ? `MC ${mcVersion}` : "MC"}
        </button>
      )}
      <select
        value={category ?? ""}
        onChange={(e) => onCategoryChange(e.target.value || undefined)}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-ring"
      >
        {CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>{t(cat.labelKey)}</option>
        ))}
      </select>
      <div className="ml-auto">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground outline-none focus:border-ring"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{t(opt.labelKey)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Main ModSearch Component ─────────────────────────────────────

interface ModSearchProps {
  instanceName: string;
  instanceMcVersion?: string;
  installedMods?: { name: string; fileName: string }[];
  initialQuery?: string;
  onUpdated?: () => void;
}

function ModSearch({ instanceName, instanceMcVersion, installedMods, initialQuery, onUpdated }: ModSearchProps) {
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
  } = useModSearch({ mcVersion: instanceMcVersion });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialQuery) {
      setFilter("query", initialQuery);
    }
  }, [initialQuery, setFilter]);

  useEffect(() => {
    if (selectedSlug) {
      searchContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedSlug]);

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

  const selectedHit = results.find((h) => h.slug === selectedSlug);

  if (selectedSlug) {
    return (
      <div>
        <ModDetails
          slug={selectedSlug}
          instanceName={instanceName}
          mcVersion={instanceMcVersion}
          isInstalled={installedMods?.some((m) => m.name === selectedHit?.title)}
          onBack={() => setSelectedSlug(null)}
          onUpdated={onUpdated}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" ref={searchContainerRef}>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder={t("mods.search")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {filters.query && (
            <button
              onClick={() => setFilter("query", "")}
              className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      <FilterBar
        mcVersion={filters.mcVersion}
        category={filters.category}
        sort={filters.sort}
        onMcVersionChange={(v) => setFilter("mcVersion", v)}
        onCategoryChange={(c) => setFilter("category", c)}
        onSortChange={(s) => setFilter("sort", s as "relevance" | "downloads" | "follows" | "newest" | "updated")}
      />

      {!loading && !error && results.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("search.resultsFor", { count: totalHits, query: filters.query })}
        </p>
      )}

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

      {hasMore && <div ref={sentinelRef} className="h-4" />}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
            <p className="text-xs text-muted-foreground">{t("search.loading")}</p>
          </div>
        </div>
      )}

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

      {!loading && !error && results.length === 0 && filters.query && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <p className="text-sm text-muted-foreground">{t("search.noResults", { query: filters.query })}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.noResultsHint")}</p>
        </div>
      )}

      {!loading && !error && !filters.query && results.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">{t("search.startHint")}</p>
          <p className="text-xs text-muted-foreground/60">{t("search.startHintSub")}</p>
        </div>
      )}
    </div>
  );
}

export default ModSearch;
