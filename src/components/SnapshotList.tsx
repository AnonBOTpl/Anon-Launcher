import { useState } from "react";
import { useSnapshots } from "@/hooks/useSnapshots";
import { formatSnapshotSize } from "@/lib/snapshot";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import RestoreSnapshotDialog from "@/components/RestoreSnapshotDialog";

interface SnapshotListProps {
  instanceName: string;
  /** Disable snapshot management while game is running */
  disabled?: boolean;
}

export default function SnapshotList({ instanceName, disabled }: SnapshotListProps) {
  const { snapshots, loading, error, creating, create, remove, restore, restoring } =
    useSnapshots(instanceName);

  const [createMode, setCreateMode] = useState<"full" | "metadata">("full");
  const [restoreTarget, setRestoreTarget] = useState<{
    timestamp: string;
    mode: "full" | "metadata";
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const handleCreate = async () => {
    setSnapshotError(null);
    try {
      await create(createMode);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to create snapshot");
    }
  };

  const handleDelete = async (timestamp: string) => {
    try {
      await remove(timestamp);
      setConfirmDelete(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to delete snapshot");
    }
  };

  const handleRestoreConfirm = async (timestamp: string, mode: "full" | "metadata") => {
    try {
      await restore(timestamp, mode);
      setRestoreTarget(null);
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Failed to restore snapshot");
    }
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
              <p className="text-sm font-medium text-amber-400">Gra jest uruchomiona</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Zarządzanie snapshotami jest zablokowane podczas gry. Zatrzymaj instancję, aby tworzyć lub przywracać snapshoty.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create snapshot */}
      <div className="flex items-center gap-3">
        <select
          value={createMode}
          onChange={(e) => setCreateMode(e.target.value as "full" | "metadata")}
          disabled={disabled}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs outline-none",
            disabled
              ? "border-muted text-muted-foreground/50 cursor-not-allowed bg-muted/50"
              : "border-input bg-background focus:border-ring",
          )}
        >
          <option value="full">Pełna kopia</option>
          <option value="metadata">Tylko metadane</option>
        </select>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={creating || disabled}
          className={cn(
            "text-xs",
            disabled
              ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20",
          )}
        >
          {creating ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-white mr-1.5" />
              Tworzenie...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Utwórz snapshot
            </>
          )}
        </Button>
      </div>

      {/* Error */}
      {snapshotError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive/80">{snapshotError}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
        </div>
      )}

      {/* Error loading */}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && snapshots.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/30">
            <path d="M11 19l-7-7 7-7" /><path d="M18 19l-7-7 7-7" />
          </svg>
          <p className="text-sm text-muted-foreground">Brak snapshotów</p>
          <p className="text-xs text-muted-foreground/60">
            Utwórz snapshot, aby zabezpieczyć instancję przed aktualizacjami
          </p>
        </div>
      )}

      {/* Snapshot list */}
      {snapshots.length > 0 && (
        <div className="space-y-1.5">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.timestamp}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-3 transition-all"
            >
              {/* Mode icon */}
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  snapshot.mode === "full"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400",
                )}
              >
                {snapshot.mode === "full" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {snapshot.mode === "full" ? "Pełna kopia" : "Tylko metadane"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {snapshot.createdAt}
                  {" · "}
                  {formatSnapshotSize(snapshot.sizeBytes)}
                  {" · "}
                  {snapshot.modCount} modów
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Restore */}
                <button
                  onClick={() =>
                    !disabled &&
                    setRestoreTarget({
                      timestamp: snapshot.timestamp,
                      mode: snapshot.mode,
                    })
                  }
                  disabled={disabled}
                  title={disabled ? "Niedostępne podczas gry" : "Przywróć snapshot"}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    disabled
                      ? "text-muted-foreground/20 cursor-not-allowed"
                      : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10",
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                </button>

                {/* Delete */}
                {disabled ? (
                  <button
                    disabled
                    title="Niedostępne podczas gry"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/20 cursor-not-allowed"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                ) : confirmDelete === snapshot.timestamp ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(snapshot.timestamp)}
                      className="h-7 text-xs px-2"
                    >
                      Usuń
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(null)}
                      className="h-7 text-xs px-2"
                    >
                      Anuluj
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(snapshot.timestamp)}
                    title="Usuń snapshot"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <RestoreSnapshotDialog
          mode={restoreTarget.mode}
          loading={restoring}
          onConfirm={() =>
            handleRestoreConfirm(restoreTarget.timestamp, restoreTarget.mode)
          }
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}
