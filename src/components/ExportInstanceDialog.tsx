import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useFileDialog } from "@/hooks/useFileDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExportInstanceDialogProps {
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExported?: () => void;
}

interface ExportProgress {
  current: number;
  total: number;
  file_name: string;
  phase: string;
}

function ExportInstanceDialog({
  instanceName,
  open,
  onOpenChange,
  onExported,
}: ExportInstanceDialogProps) {
  const { t } = useTranslation();
  const { showSaveDialog } = useFileDialog();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const unlistenRef = useRef<(() => void)[]>([]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      unlistenRef.current.forEach((fn) => fn());
      unlistenRef.current = [];
    };
  }, []);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(false);
    setProgress(null);

    try {
      // Open native save dialog
      const savePath = await showSaveDialog({
        defaultName: `${instanceName.replace(/[<>:"/\\|?*]/g, "_")}.zip`,
        filterName: "Archiwum ZIP",
        extensions: ["zip"],
      });

      if (!savePath) {
        setExporting(false);
        return; // User cancelled
      }

      // Subscribe to events
      const unlistenProgress = await listen<ExportProgress>("export:progress", (event) => {
        setProgress(event.payload);
      });

      const unlistenComplete = await listen<{ path: string }>("export:complete", () => {
        setSuccess(true);
        setExporting(false);
        onExported?.();
      });

      const unlistenError = await listen<{ message: string }>("export:error", (event) => {
        setError(event.payload.message);
        setExporting(false);
      });

      unlistenRef.current = [unlistenProgress, unlistenComplete, unlistenError];

      // Invoke the backend command — returns immediately, events drive progress
      await invoke("export_instance", {
        instanceName,
        outputPath: savePath,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("export.errors.startFailed"),
      );
      setExporting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setError(null);
      setSuccess(false);
      setProgress(null);
      // Cleanup listeners
      unlistenRef.current.forEach((fn) => fn());
      unlistenRef.current = [];
    }
    onOpenChange(open);
  }

  // Compute progress percentage
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>
            {t("export.description", { instanceName })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {t("export.successDesc")}
              </div>
            </div>
          )}

          {exporting && (
            <div className="space-y-3 py-2">
              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300 ease-out",
                    progress?.phase === "counting"
                      ? "bg-primary animate-pulse"
                      : "bg-gradient-to-r from-primary to-primary/80",
                  )}
                  style={{
                    width: progress?.phase === "counting"
                      ? "100%"
                      : `${progressPct}%`,
                  }}
                />
              </div>

              {/* Status text */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {progress?.phase === "counting" ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span>{t("export.countingFiles")}</span>
                    </>
                  ) : progress?.phase === "compressing" ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="truncate max-w-[200px]">
                        {progress.file_name}
                      </span>
                    </>
                  ) : progress?.phase === "done" ? (
                    <span className="text-emerald-400">{t("export.finalizing")}</span>
                  ) : (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span>{t("export.compressing")}</span>
                    </>
                  )}
                </div>
                {progress && progress.total > 0 && progress.phase === "compressing" && (
                  <span className="text-muted-foreground tabular-nums">
                    {progress.current}/{progress.total}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={exporting}
          >
            {success ? t("export.close") : t("export.cancel")}
          </Button>
          {!success && (
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? t("export.exporting") : t("export.start")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportInstanceDialog;
