import { useState, useCallback } from "react";
import { useMods } from "@/hooks/useMods";
import { useModIcons } from "@/hooks/useModIcons";
import { useModUpdates } from "@/hooks/useModUpdates";
import { updateMod as updateModApi } from "@/lib/mod-updater";
import * as modApi from "@/lib/mod-installer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ModSearch from "@/components/ModSearch";
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
}

function ModCard({ mod, iconUrl, update, onToggle, onRemove, onUpdate, onSearchMod }: ModCardProps) {
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
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          mod.enabled ? "bg-purple-500" : "bg-muted",
        )}
        title={mod.enabled ? "Wyłącz" : "Włącz"}
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
              Aktualizacja
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          {mod.versionNumber ? (
            <span className="font-mono">{mod.versionNumber}</span>
          ) : mod.versionId ? (
            <span className="font-mono" title={mod.versionId}>{mod.versionId.slice(0, 8)}…</span>
          ) : (
            <span className="italic">nieznana wersja</span>
          )}
          {mod.enabled ? (
            <span className="text-muted-foreground/50">·</span>
          ) : (
            <span className="text-destructive/70">· wyłączony</span>
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
            onClick={() => onSearchMod(mod.name)}
            title="Znajdź na Modrinth"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
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
            disabled={updatingMod}
            title={`Aktualizuj do ${update.newVersionNumber}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
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
        {confirmRemove ? (
          <div className="flex items-center gap-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={removing}
              className="h-7 text-xs px-2"
            >
              {removing ? "..." : "Usuń"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmRemove(false)}
              className="h-7 text-xs px-2"
            >
              Anuluj
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            title="Odinstaluj mod"
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

function ModList({ instanceName, instanceMcVersion }: ModListProps) {
  const { mods, loading, error, toggle, remove, refresh } = useMods(instanceName);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const iconMap = useModIcons(mods);

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

  const handleUpdateAll = useCallback(async () => {
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
  }, [instanceName, refresh, updates]);

  const openSearch = (query?: string) => {
    // Strip version numbers from the name before searching
    setSearchQuery(query ? cleanSearchQuery(query) : undefined);
    setShowSearch(true);
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery(undefined);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Ładowanie modów..."
              : error
                ? "Błąd ładowania"
                : `${mods.length} modów zainstalowanych`}
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
                  Sprawdzanie...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                  </svg>
                  {hasUpdates ? `${updates.length} aktualizacji` : "Aktualizacje"}
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
              Aktualizuj wszystkie ({updates.length})
            </Button>
          )}

          {/* Progress bar while checking */}

          <Button
            onClick={() => showSearch ? closeSearch() : openSearch()}
            size="sm"
            className={cn(
              "text-xs h-7",
              showSearch
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
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
            {showSearch ? "Zamknij" : "Dodaj mod"}
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

      {/* Search panel (inline) */}
      {showSearch ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <ModSearch
            instanceMcVersion={instanceMcVersion}
            installedMods={mods.map(m => ({ name: m.name, fileName: m.fileName }))}
            initialQuery={searchQuery}
            onInstall={async (versionId, versionNumber, downloadUrl, fileName, modName, projectSlug, iconUrl) => {
              try {
                await modApi.installMod(instanceName, versionId, versionNumber, downloadUrl, fileName, modName, projectSlug, iconUrl);
                refresh();
                closeSearch();
              } catch (err) {
                console.error("Install failed:", err);
              }
            }}
            onUninstall={async (fileName) => {
              try {
                await modApi.removeMod(instanceName, fileName);
                refresh();
              } catch (err) {
                console.error("Uninstall failed:", err);
              }
            }}
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
              <p className="text-sm text-muted-foreground">Brak zainstalowanych modów</p>
              <p className="text-xs text-muted-foreground/60">Kliknij \"Dodaj mod\", aby wyszukać i zainstalować</p>
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
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ModList;
