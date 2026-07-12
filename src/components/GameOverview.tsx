import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import type { ScreenshotInfo } from "@/types/gameData";
import type { InstanceManifest } from "@/types/instance";
import { useMods } from "@/hooks/useMods";

// ─── Helpers ────────────────────────────────────────────────────────

/** Format a filesystem timestamp into a locale-aware relative string */
function formatTimestamp(iso: string | null): string {
  if (!iso || iso === "unknown") return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = then - now;
  const absDiffSecs = Math.floor(Math.abs(diffMs) / 1000);

  if (absDiffSecs < 10) return i18n.t("gameOverview.justNow");

  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" });

  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [86400 * 365, "year"],
    [86400 * 30, "month"],
    [86400 * 7, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];

  // Since the timestamp is in the past, diffMs is negative
  for (const [secs, unit] of units) {
    const val = Math.floor(absDiffSecs / secs);
    if (val >= 1) {
      // Intl.RelativeTimeFormat handles pluralization: "2 hours ago", "2 godziny temu"
      return rtf.format(-val, unit);
    }
  }

  return i18n.t("gameOverview.justNow");
}

/** Format bytes into human-readable size */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

// ─── Skeleton Loader ────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-24 animate-pulse rounded-xl bg-muted/30",
        className,
      )}
    />
  );
}

// ─── Screenshot Thumbnail (reads via backend base64 command) ───────

function ScreenshotThumbnail({ path, alt }: { path: string; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    invoke<string>("read_screenshot", { path })
      .then((result) => {
        if (!cancelled) {
          setDataUrl(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [path]);

  if (loading) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="h-5 w-5 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary/50"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
    />
  );
}

// ─── Props ──────────────────────────────────────────────────────────

interface GameOverviewProps {
  instanceName: string;
  manifest: InstanceManifest | null;
}

// ─── Component ──────────────────────────────────────────────────────

function GameOverview({ instanceName, manifest }: GameOverviewProps) {
  const { t } = useTranslation();

  // Game data state
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[] | undefined>(undefined);
  const [instanceSize, setInstanceSize] = useState<number | undefined>(undefined);
  const [gameDataLoading, setGameDataLoading] = useState(true);

  // Screenshot modal state
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotInfo | null>(null);
  const [selectedScreenshotUrl, setSelectedScreenshotUrl] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Hooks
  const { mods, loading: modsLoading } = useMods(instanceName);

  // Open instance subfolder (screenshots, saves, etc.)
  const openSubfolder = useCallback((subfolder: string) => {
    invoke("open_instance_subfolder", {
      instanceName,
      subfolder,
    }).catch(() => {});
  }, [instanceName]);

  // Open screenshot modal
  const openScreenshot = useCallback(async (shot: ScreenshotInfo) => {
    setSelectedScreenshot(shot);
    setModalLoading(true);
    setSelectedScreenshotUrl(null);
    try {
      const dataUrl = await invoke<string>("read_screenshot", { path: shot.path });
      setSelectedScreenshotUrl(dataUrl);
    } catch {
      // Keep null — error state handled in UI
    } finally {
      setModalLoading(false);
    }
  }, []);

  const closeScreenshot = useCallback(() => {
    setSelectedScreenshot(null);
    setSelectedScreenshotUrl(null);
  }, []);

  // Fetch game data
  useEffect(() => {
    if (!instanceName) return;
    let cancelled = false;

    async function fetchData() {
      setGameDataLoading(true);

      const [shots, size] = await Promise.all([
        invoke<ScreenshotInfo[]>("get_recent_screenshots", { instanceName }).catch(() => []),
        invoke<number>("get_instance_size", { instanceName }).catch(() => 0),
      ]);

      if (!cancelled) {
        setScreenshots(shots);
        setInstanceSize(size);
        setGameDataLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [instanceName]);

  // Derived values
  const isLoading = gameDataLoading || modsLoading;
  const activeMods = mods.filter((m) => m.enabled).length;
  const disabledMods = mods.filter((m) => !m.enabled).length;

  return (
    <div className="space-y-6">
      {/* ── Screenshots Section ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
            {t("gameOverview.screenshots")}
          </h3>

        </div>

        {isLoading ? (
          <div className="flex gap-3">
            <SkeletonBlock className="h-20 w-1/3" />
            <SkeletonBlock className="h-20 w-1/3" />
            <SkeletonBlock className="h-20 w-1/3" />
          </div>
        ) : screenshots && screenshots.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {screenshots.map((shot) => (
              <button
                key={shot.filename}
                onClick={() => openScreenshot(shot)}
                className="group relative flex-1 min-w-[160px] max-w-[220px] overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-muted/30 to-muted/10 p-3 backdrop-blur-sm text-left transition-all duration-300 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
              >
                {/* Screenshot thumbnail */}
                <div className="mb-2 aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                  <ScreenshotThumbnail path={shot.path} alt={shot.filename} />
                </div>

                {/* Filename */}
                <p className="truncate text-xs font-medium text-foreground/80">
                  {shot.filename}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                  {formatTimestamp(shot.lastModified)} · {formatBytes(shot.fileSize)}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/30 bg-muted/10 p-6 text-center">
            <p className="text-sm text-muted-foreground/50 italic">
              {t("gameOverview.noScreenshotsYet")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/40">
              {t("gameOverview.noScreenshotsHint")}
            </p>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-border/30" />

      {/* ── Stats Section ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t("gameOverview.statistics")}
        </h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            <>
              <SkeletonBlock className="h-24" />
              <SkeletonBlock className="h-24" />
              <SkeletonBlock className="h-24" />
              <SkeletonBlock className="h-24" />
            </>
          ) : (
            <>
              {/* Mods */}
              <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7" />
                      <path d="M15 7h2v2" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-tight text-foreground">
                      {activeMods + disabledMods}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {t("gameOverview.mods")}
                      {disabledMods > 0 && (
                        <span className="ml-1">({disabledMods} {t("gameOverview.disabled")})</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Java */}
              <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-tight text-foreground">
                      {t("gameOverview.java")} {manifest?.javaVersion ?? "?"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {manifest?.customJavaPath ? t("gameOverview.custom") : t("gameOverview.runtime")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Size */}
              <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-tight text-foreground">
                      {formatBytes(instanceSize ?? 0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      {t("gameOverview.diskUsage")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Loader info */}
              <div className="rounded-xl border border-border/40 bg-card/20 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60"
                    style={{
                      backgroundColor: manifest?.loader === "fabric"
                        ? "rgba(251,191,36,0.1)"
                        : manifest?.loader === "neoforge"
                          ? "rgba(56,189,248,0.1)"
                          : "rgba(52,211,153,0.1)",
                      color: manifest?.loader === "fabric"
                        ? "#fbbf24"
                        : manifest?.loader === "neoforge"
                          ? "#38bdf8"
                          : "#34d399",
                    }}
                  >
                    {manifest?.loader === "fabric" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    ) : manifest?.loader === "neoforge" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <p className="text-lg font-bold leading-tight text-foreground">
                      {manifest?.loader === "fabric"
                        ? `Fabric ${manifest.loaderVersion}`
                        : manifest?.loader === "neoforge"
                          ? `NeoForge ${manifest.loaderVersion}`
                          : "Vanilla"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60">
                      MC {manifest?.mcVersion ?? "?"}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-border/30" />

      {/* ── Quick Links Section ── */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
          {t("gameOverview.quickLinks")}
        </h3>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => openSubfolder("screenshots")}
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/20 px-4 py-2.5 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
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
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {t("gameOverview.screenshotsFolder")}
          </button>

          <button
            onClick={() => openSubfolder("saves")}
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-card/20 px-4 py-2.5 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
          >
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
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {t("gameOverview.savesFolder")}
          </button>
        </div>
      </div>

      {/* ── Screenshot Full-size Modal ── */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeScreenshot}
        >
          <div
            className="relative max-h-[90vh] max-w-[95vw] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-2.5">
              <p className="text-sm font-medium truncate pr-4">{selectedScreenshot.filename}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => invoke("open_instance_subfolder", { instanceName, subfolder: "screenshots" }).catch(() => {})}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                  title={t("gameOverview.openFolder")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button
                  onClick={closeScreenshot}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Image */}
            <div className="flex items-center justify-center p-2">
              {modalLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
                </div>
              ) : selectedScreenshotUrl ? (
                <img
                  src={selectedScreenshotUrl}
                  alt={selectedScreenshot.filename}
                  className="max-h-[80vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm">{t("errors.loadFailed")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameOverview;
