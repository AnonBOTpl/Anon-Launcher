import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMods } from "@/hooks/useMods";
import { useModIcons } from "@/hooks/useModIcons";
import { useModUpdates } from "@/hooks/useModUpdates";
import { updateMod as updateModApi } from "@/lib/mod-updater";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ModSearch from "@/components/ModSearch";
import * as snapshotApi from "@/lib/snapshot";
import type { InstalledMod } from "@/lib/mod-installer";
import type { ModUpdate } from "@/lib/mod-updater";

// ─── Helpers ────────────────────────────────────────────────────────

/** Strip version-like patterns from a mod name for search queries. */
function cleanSearchQuery(name: string): string {
  // Remove trailing version patterns: "Sodium Fabric 0.5.11 Mc1.21" → "Sodium Fabric"
  return name
    .replace(/\s+\d+\.\d+(\.\d+)?[-+\s].*$/i, "")
    .replace(/\s+\d+\.\d+(\.\d+)?$/, "")
    .replace(/\s+mc[\d.]+.*$/i, "")
    .trim();
}

interface ModListProps {
  instanceName: string;
  instanceMcVersion?: string;
  /** Called when mod updates availability changes (for badge on tab) */
  onUpdatesFound?: (found: boolean) => void;
  /** Disable mod management while game is running */
  disabled?: boolean;
}

// ─── ModCard ────────────────────────────────────────────────────────

interface ModCardProps {
  mod: InstalledMod;
  iconUrl?: string | null;
  update?: ModUpdate | null;
  onToggle: (fileName: string, enabled: boolean) => void;
  onRemove: (fileName: string) => void;
  onUpdate: (update: ModUpdate) => Promise<boolean>;
  onSearchMod: (query: string) => void;
  /** Disable actions when game is running */
  disabled?: boolean;
}

function ModCard({ mod, iconUrl, update, onToggle, onRemove, onUpdate, onSearchMod, disabled }: ModCardProps) {
  const { t } = useTranslation();
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [updatingMod, setUpdatingMod] = useState(false);

  const handleToggle = () => {
    onToggle(mod.fileName, !mod.enabled);
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(mod.fileName);
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  const handleUpdate = async () => {
    if (!update) return;
    setUpdatingMod(true);
    try {
      await onUpdate(update);
    } finally {
      setUpdatingMod(false);
    }
  };

  // Derive display name from file name if no clean name available
  const displayName = mod.name || mod.fileName.replace(/\.jar(\.disabled)?$/, "");
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 transition-all",
        !mod.enabled && "opacity-50",
        updatingMod && "animate-pulse",
      )}
    >
      {/* Toggle switch */}
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          mod.enabled ? "bg-purple-500" : "bg-muted",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        title={disabled ? t("mods.unavailable") : (mod.enabled ? t("mods.disable") : t("mods.enable"))}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
            mod.enabled && "translate-x-4",
          )}
        />
      </button>

      {/* Icon */}
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={displayName}
          className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          loading="lazy"
        />
      ) : (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            mod.enabled
              ? "bg-purple-500/20 text-purple-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{displayName}</p>
          {update && (
            <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400 ring-1 ring-amber-500/20">
              {t("mods.update")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          {mod.versionNumber ? (
            <span className="font-mono">{mod.versionNumber}</span>
          ) : mod.versionId ? (
            <span className="font-mono" title={mod.versionId}>{mod.versionId.slice(0, 8)}…</span>
          ) : (
            <span className="italic">{t("mods.unknownVersion")}</span>
          )}
          {mod.enabled ? (
            <span className="text-muted-foreground/50">·</span>
          ) : (
            <span className="text-destructive/70">· {t("mods.disabled")}</span>
          )}
        </p>
        {/* Update info */}
        {update && (
          <p className="text-[11px] text-amber-400/80 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
            {update.newVersionNumber}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Search button for mods without projectSlug */}
        {!mod.projectSlug && (
          <button
            onClick={() => !disabled && onSearchMod(mod.name)}
            disabled={disabled}
            title={disabled ? t("mods.unavailable") : t("mods.findOnModrinth")}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              disabled
                ? "text-muted-foreground/20 cursor-not-allowed"
                : "text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10",
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        )}

        {/* Update button for mods with update available */}
        {update && (
          <button
            onClick={handleUpdate}
            disabled={updatingMod || disabled}
            title={disabled ? t("mods.unavailable") : t("mods.updateTo", { version: update.newVersionNumber })}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              disabled
                ? "text-muted-foreground/20 cursor-not-allowed"
                : "text-amber-400 hover:bg-amber-500/10",
            )}
          >
            {updatingMod ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-amber-400" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
          </button>
        )}

        {/* Remove button */}
        {disabled ? (
          <button
            disabled
            title={t("mods.unavailable")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/20 cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        ) : confirmRemove ? (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={removing}
              className="h-7 text-xs px-2"
            >
              {removing ? "..." : t("mods.remove")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(false)}
              className="h-7 text-xs px-2"
            >
              {t("mods.cancel")}
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            title={t("mods.uninstall")}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main ModList Component ────────────────────────────────────────

function ModList({ instanceName, instanceMcVersion, onUpdatesFound, disabled }: ModListProps) {
  const { t } = useTranslation();
  const { mods, loading, error, toggle, remove, refresh } = useMods(instanceName);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const iconMap = useModIcons(mods);

  // Snapshot before update dialog — null means closed
  const [snapshotBeforeUpdate, setSnapshotBeforeUpdate] = useState<{
    mode: "full" | "metadata" | null;
    creating: boolean;
  } | null>(null);

  const {
    updates,
    checking,
    progress: checkingProgress,
    error: checkError,
    hasUpdates,
    checkNow,
  } = useModUpdates({
    mods,
    mcVersion: instanceMcVersion,
    autoCheckInterval: 5 * 60 * 1000,
  });

  // Notify parent when update availability changes
  useEffect(() => {
    onUpdatesFound?.(hasUpdates);
  }, [hasUpdates, onUpdatesFound]);

  // Build a map of fileName → ModUpdate for quick lookup
  const updateMap = new Map<string, ModUpdate>();
  for (const u of updates) {
    updateMap.set(u.mod.fileName, u);
  }

  // Count how many mods are checkable (have projectSlug)
  const checkableCount = mods.filter((m) => m.projectSlug).length;

  // Update callbacks
  const handleUpdateMod = useCallback(
    async (update: ModUpdate): Promise<boolean> => {
      try {
        await updateModApi(
          instanceName,
          update.mod.fileName,
          update.newFile.filename,
          update.newFile.url,
          update.newVersion.id,
          update.newVersionNumber,
          update.mod.iconUrl,
        );
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [instanceName, refresh],
  );

  const handleUpdateAll = useCallback(async () => {    // Show snapshot dialog before updating
    setSnapshotBeforeUpdate({ mode: null, creating: false });
  }, []);

  const handleCloseSnapshot = useCallback(() => {
    setSnapshotBeforeUpdate(null);
  }, []);

  const handleConfirmUpdateAll = useCallback(
    async (snapshotMode: "full" | "metadata" | "skip") => {
      if (snapshotMode !== "skip") {
        setSnapshotBeforeUpdate({ mode: snapshotMode, creating: true });
        try {
          await snapshotApi.createSnapshot(instanceName, snapshotMode);
        } catch (err) {
          console.error("Failed to create snapshot before update:", err);
        }
      }
      setSnapshotBeforeUpdate(null);

      for (const update of updates) {
        try {
          await updateModApi(
            instanceName,
            update.mod.fileName,
            update.newFile.filename,
            update.newFile.url,
            update.newVersion.id,
            update.newVersionNumber,
            update.mod.iconUrl,
          );
        } catch {
          // Continue with next
        }
      }
      await refresh();
    },
    [instanceName, refresh, updates],
  );

  // ─── Search is now managed by ModSearch itself (including deps) ────
  // ModList just provides instanceName and refresh callback

  const openSearch = (query?: string) => {
    setSearchQuery(query ? cleanSearchQuery(query) : undefined);
    setShowSearch(true);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Running blocker banner */}
      {disabled && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-400">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-400">{t("runningBlocked.gameRunning")}</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                {t("mods.blockedBanner")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {loading
              ? t("mods.loading")
              : error
                ? t("mods.loadError")
                : t("mods.modCount", { count: mods.length })}
          </p>
          {checkableCount > 0 && (
            <button
              onClick={() => {
                if (!hasUpdates && !checking) checkNow();
              }}
              disabled={checking}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                hasUpdates
                  ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 hover:bg-amber-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {checking ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
                  {t("mods.checking")}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                  </svg>
                  {hasUpdates ? t("mods.updatesAvailable", { count: updates.length }) : t("mods.checkUpdates")}
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Aktualizuj wszystkie — visible when updates are found */}
          {hasUpdates && !showSearch && (
            <Button
              onClick={handleUpdateAll}
              size="sm"
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg shadow-amber-500/20 text-xs h-7"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("mods.updateAll", { count: updates.length })}
            </Button>
          )}

          {/* Progress bar while checking */}

          <Button
            onClick={() => showSearch ? closeSearch() : openSearch()}
            size="sm"
            disabled={disabled && !showSearch}
            className={cn(
              "text-xs h-7",
              showSearch
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : disabled
                  ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20",
            )}
          >
            {showSearch ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
            {showSearch ? t("mods.close") : t("mods.addMod")}
          </Button>
        </div>
      </div>

      {/* Checking progress bar */}
      {checking && checkingProgress && (
        <div className="rounded-lg border border-border/50 bg-card/50 p-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-300"
                style={{ width: `${(checkingProgress.checked / checkingProgress.total) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
              {checkingProgress.currentName} ({checkingProgress.checked}/{checkingProgress.total})
            </span>
          </div>
        </div>
      )}

      {/* Checking error */}
      {checkError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive/80">{checkError}</p>
        </div>
      )}

      {/* Search panel (inline) — ModSearch handles deps & install internally */}
      {showSearch ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <ModSearch
            instanceName={instanceName}
            instanceMcVersion={instanceMcVersion}
            installedMods={mods.map(m => ({ name: m.name, fileName: m.fileName }))}
            initialQuery={searchQuery}
            onUpdated={() => { refresh(); closeSearch(); }}
          />
        </div>
      ) : (
        <>
          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && mods.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
              </svg>
              <p className="text-sm text-muted-foreground">{t("mods.noMods")}</p>
              <p className="text-xs text-muted-foreground/60">{t("mods.addModHint")}</p>
            </div>
          )}

          {/* Mod list */}
          {mods.length > 0 && (
            <div className="space-y-1.5">
              {mods
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((mod) => (
                  <ModCard
                    key={mod.fileName}
                    mod={mod}
                    iconUrl={mod.iconUrl ?? iconMap.get(mod.fileName)}
                    update={updateMap.get(mod.fileName) ?? null}
                    onToggle={toggle}
                    onRemove={remove}
                    onUpdate={handleUpdateMod}
                    onSearchMod={(query) => openSearch(query)}
                    disabled={disabled}
                  />
                ))}
            </div>
          )}
        </>
      )}

      {/* Snapshot dialog — only when explicitly opened by "Aktualizuj wszystkie" */}
      {snapshotBeforeUpdate && snapshotBeforeUpdate.mode === null && !snapshotBeforeUpdate.creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCloseSnapshot}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{t("mods.snapshotBeforeUpdate")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("mods.snapshotBeforeUpdateDesc")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                size="sm"
                onClick={() => handleConfirmUpdateAll("full")}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t("mods.snapshotFullRecommended")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleConfirmUpdateAll("metadata")}
                className="w-full text-xs"
              >
                {t("mods.snapshotMetaOnly")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleConfirmUpdateAll("skip")}
                className="w-full text-xs text-muted-foreground"
              >
                {t("mods.snapshotSkip")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Creating snapshot loading */}
      {snapshotBeforeUpdate && snapshotBeforeUpdate.creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-fade-in">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              <p className="text-sm text-muted-foreground">
                {t("mods.snapshotCreating")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MissingDepsWarning is now rendered inline inside ModSearch/ModDetails */}
    </div>
  );
}

export default ModList;
