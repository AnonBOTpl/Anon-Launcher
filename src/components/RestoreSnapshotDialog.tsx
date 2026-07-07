import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RestoreSnapshotDialogProps {
  mode: "full" | "metadata";
  loading: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function RestoreSnapshotDialog({
  mode,
  loading,
  onConfirm,
  onCancel,
}: RestoreSnapshotDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-1">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              mode === "full"
                ? "bg-amber-500/20"
                : "bg-blue-500/20"
            }`}
          >
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
              className={mode === "full" ? "text-amber-400" : "text-blue-400"}
            >
              {mode === "full" ? (
                <>
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </>
              ) : (
                <>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </>
              )}
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              Przywróć snapshot
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "full"
                ? "Cała instancja zostanie zastąpiona kopią z snapshotu. Bieżące dane zostaną utracone."
                : "Zostanie przywrócona konfiguracja i lista modów. Pliki JAR nie zostaną pobrane."}
            </p>
          </div>
        </div>

        {/* Warning for full restore */}
        {mode === "full" && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs text-destructive/80">
              <strong>Ostrzeżenie:</strong> Ta operacja usunie bieżący stan
              instancji i zastąpi go stanem z snapshotu.
              {loading && " Przywracanie..."}
            </p>
          </div>
        )}

        {/* Danger zone — confirm by typing */}
        {mode === "full" && (
          <div className="mt-3">
            <label className="text-xs text-muted-foreground mb-1 block">
              Wpisz <span className="font-mono text-foreground">przywróć</span>, aby potwierdzić:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="przywróć"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-ring"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            className="text-xs"
          >
            Anuluj
          </Button>
          <Button
            variant={mode === "full" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
            disabled={
              loading || (mode === "full" && confirmText !== "przywróć")
            }
            className="text-xs"
          >
            {loading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-white mr-1.5" />
                Przywracanie...
              </>
            ) : (
              "Przywróć"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
