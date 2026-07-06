import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

interface ExportInstanceDialogProps {
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExported?: () => void;
}

function ExportInstanceDialog({
  instanceName,
  open,
  onOpenChange,
  onExported,
}: ExportInstanceDialogProps) {
  const { showSaveDialog } = useFileDialog();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(false);

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

      // Invoke the backend command
      await invoke("export_instance", {
        instanceName,
        outputPath: savePath,
      });

      setSuccess(true);
      onExported?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się wyeksportować instancji",
      );
    } finally {
      setExporting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setError(null);
      setSuccess(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eksportuj instancję</DialogTitle>
          <DialogDescription>
            Wyeksportuj <strong>{instanceName}</strong> do archiwum ZIP.
            Wszystkie pliki instancji zostaną skompresowane.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
              Instancja została pomyślnie wyeksportowana!
            </div>
          )}

          {exporting && (
            <div className="flex items-center justify-center gap-3 py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <span className="text-sm text-muted-foreground">
                Kompresowanie instancji...
              </span>
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
            {success ? "Zamknij" : "Anuluj"}
          </Button>
          {!success && (
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Eksportowanie..." : "Wybierz lokalizację i eksportuj"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportInstanceDialog;
