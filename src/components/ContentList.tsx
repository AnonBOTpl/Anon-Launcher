import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ContentBrowser from "@/components/ContentBrowser";
import * as contentApi from "@/lib/content-installer";
import type { InstalledContent } from "@/types/content";

// ─── Helpers ────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

interface ContentListProps {
  instanceName: string;
  folder: "resourcepacks" | "shaderpacks";
  /** For shaderpacks: whether Iris is installed (only relevant for shaders) */
  irisInstalled?: boolean;
  /** For shaderpacks: callback to install Iris */
  onInstallIris?: () => Promise<void>;
  /** Disable content management while game is running */
  disabled?: boolean;
}

// ─── ContentCard ────────────────────────────────────────────────────

interface ContentCardProps {
  item: InstalledContent;
  onRemove: (fileName: string) => void;
  disabled?: boolean;
}

function ContentCard({ item, onRemove, disabled }: ContentCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const displayName = item.title || item.fileName.replace(/\.zip|\.mrpack|\.jar|\.disabled$/i, "");

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await onRemove(item.fileName);
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 transition-all">
      {/* Icon */}
      {item.iconUrl ? (
        <img
          src={item.iconUrl}
          alt={displayName}
          className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-border/50"
          loading="lazy"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600/20 to-purple-600/5 text-xs font-bold text-purple-400 ring-1 ring-border/50">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{displayName}</p>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          {item.versionNumber ? (
            <span className="font-mono">{item.versionNumber}</span>
          ) : (
            <span className="italic">nieznana wersja</span>
          )}
          <span className="text-muted-foreground/50">·</span>
          <span>{formatSize(item.size)}</span>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {disabled ? (
          <button
            disabled
            title="Niedostępne podczas gry"
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
            title="Usuń"
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

// ─── Main ContentList Component ─────────────────────────────────────

function ContentList({ instanceName, folder, irisInstalled, onInstallIris, disabled }: ContentListProps) {
  const [items, setItems] = useState<InstalledContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [installingIris, setInstallingIris] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await contentApi.listContent(instanceName, folder);
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się załadować listy.");
    } finally {
      setLoading(false);
    }
  }, [instanceName, folder]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRemove = useCallback(async (fileName: string) => {
    try {
      await contentApi.removeContent(instanceName, folder, fileName);
      await loadItems();
    } catch (err) {
      console.error("Remove failed:", err);
    }
  }, [instanceName, folder, loadItems]);

  // Determine label based on folder
  const label = folder === "resourcepacks" ? "paczek zasobów" : "shaderpacków";
  const labelSingle = folder === "resourcepacks" ? "paczkę zasobów" : "shaderpack";
  const searchPlaceholder = folder === "resourcepacks" ? "Szukaj paczek zasobów..." : "Szukaj shaderpacków...";
  const projectType = folder === "resourcepacks" ? "resourcepack" : "shader";

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
              <p className="text-sm font-medium text-amber-400">Gra jest uruchomiona</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Zarządzanie {folder === "resourcepacks" ? "paczkami zasobów" : "shaderpackami"} jest zablokowane podczas gry. Zatrzymaj instancję, aby modyfikować zawartość.
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
              ? "Ładowanie..."
              : error
                ? "Błąd ładowania"
                : `${items.length} ${label} zainstalowanych`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowSearch(!showSearch)}
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
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
                Zamknij
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Dodaj {labelSingle}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Iris not installed banner (only for shaders) */}
      {folder === "shaderpacks" && irisInstalled === false && !showSearch && !disabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-400">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="12" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">Shaderpacki wymagają Iris Shaders</p>
              <p className="mt-0.5 text-xs text-amber-400/70">
                Aby używać shaderpacków, musisz zainstalować mod <strong>Iris Shaders</strong>.
                Kliknij poniżej, aby automatycznie pobrać i zainstalować najnowszą wersję Iris.
              </p>
              <Button
                size="sm"
                onClick={async () => {
                  if (!onInstallIris) return;
                  setInstallingIris(true);
                  try {
                    await onInstallIris();
                  } finally {
                    setInstallingIris(false);
                  }
                }}
                disabled={installingIris || !onInstallIris}
                className="mt-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs"
              >
                {installingIris ? (
                  <>
                    <div className="h-3 w-3 mr-1.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Instalowanie Iris...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Zainstaluj Iris Shaders
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search panel (inline) */}
      {showSearch && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <ContentBrowser
            projectType={projectType}
            placeholder={searchPlaceholder}
            instanceName={instanceName}
            folder={folder}
            onInstalled={loadItems}
          />
        </div>
      )}

      {/* Loading */}
      {loading && !showSearch && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
        </div>
      )}

      {/* Error */}
      {error && !showSearch && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && !showSearch && (
        <div className="flex flex-col items-center gap-3 py-12">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          <p className="text-sm text-muted-foreground">
            Brak zainstalowanych {label}
            {folder === "shaderpacks" && irisInstalled === false && " (zainstaluj Iris Shaders)"}
          </p>
          <p className="text-xs text-muted-foreground/60">Kliknij "Dodaj {labelSingle}", aby wyszukać i zainstalować</p>
        </div>
      )}

      {/* Content list */}
      {items.length > 0 && !showSearch && (
        <div className="space-y-1.5">
          {items.map((item) => (
            <ContentCard
              key={item.fileName}
              item={item}
              onRemove={handleRemove}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ContentList;
