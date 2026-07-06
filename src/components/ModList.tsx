import { useState } from "react";
import { useMods } from "@/hooks/useMods";
import { useModIcons } from "@/hooks/useModIcons";
import * as modApi from "@/lib/mod-installer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ModSearch from "@/components/ModSearch";
import type { InstalledMod } from "@/lib/mod-installer";

interface ModListProps {
  instanceName: string;
  instanceMcVersion?: string;
}

// ─── ModCard ────────────────────────────────────────────────────────

interface ModCardProps {
  mod: InstalledMod;
  iconUrl?: string | null;
  onToggle: (fileName: string, enabled: boolean) => void;
  onRemove: (fileName: string) => void;
}

function ModCard({ mod, iconUrl, onToggle, onRemove }: ModCardProps) {
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

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

  // Derive display name from file name if no clean name available
  const displayName = mod.name || mod.fileName.replace(/\.jar(\.disabled)?$/, "");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 transition-all",
        !mod.enabled && "opacity-50",
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
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-[11px] text-muted-foreground">
          {mod.enabled ? "Aktywny" : "Wyłączony"}
        </p>
      </div>

      {/* Remove button */}
      {confirmRemove ? (
        <div className="flex items-center gap-1 shrink-0">
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
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Main ModList Component ────────────────────────────────────────

function ModList({ instanceName, instanceMcVersion }: ModListProps) {
  const { mods, loading, error, toggle, remove, refresh } = useMods(instanceName);
  const [showSearch, setShowSearch] = useState(false);
  const iconMap = useModIcons(mods);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Ładowanie modów..."
              : error
                ? "Błąd ładowania"
                : `${mods.length} modów zainstalowanych`}
          </p>
        </div>
        <Button
          onClick={() => setShowSearch(!showSearch)}
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20"
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
          {showSearch ? "Zamknij wyszukiwarkę" : "Dodaj mod"}
        </Button>
      </div>

      {/* Search panel (inline) */}
      {showSearch && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <ModSearch
            instanceMcVersion={instanceMcVersion}
            installedMods={mods.map(m => ({ name: m.name, fileName: m.fileName }))}
            onInstall={async (versionId, downloadUrl, fileName, modName, projectSlug, iconUrl) => {
              try {
                await modApi.installMod(instanceName, versionId, downloadUrl, fileName, modName, projectSlug, iconUrl);
                refresh();
                setShowSearch(false);
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
      )}

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
      {!loading && !error && mods.length === 0 && !showSearch && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">Brak zainstalowanych modów</p>
          <p className="text-xs text-muted-foreground/60">Kliknij "Dodaj mod", aby wyszukać i zainstalować</p>
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
                onToggle={toggle}
                onRemove={remove}
              />
            ))}
        </div>
      )}
    </div>
  );
}

export default ModList;
