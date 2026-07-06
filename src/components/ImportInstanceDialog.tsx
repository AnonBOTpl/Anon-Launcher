import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImportInstanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

function ImportInstanceDialog({
  open,
  onOpenChange,
  onImported,
}: ImportInstanceDialogProps) {
  const navigate = useNavigate();
  const { showOpenDialog } = useFileDialog();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"select" | "confirm" | "done">("select");
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [detectedName, setDetectedName] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);

  async function handleSelectFile() {
    setError(null);

    try {
      const path = await showOpenDialog({
        filterName: "Archiwum ZIP",
        extensions: ["zip"],
      });

      if (!path) return; // User cancelled

      setZipPath(path);

      // Validate ZIP in the background
      setImporting(true);
      const validation = await invoke<{
        instanceName: string;
        schemaVersion: number;
        needsMigration: boolean;
      }>("validate_import_zip", { zipPath: path });
      setImporting(false);

      setDetectedName(validation.instanceName);
      setCustomName(validation.instanceName);
      setNeedsMigration(validation.needsMigration);
      setStep("confirm");
    } catch (err) {
      setImporting(false);
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się otworzyć pliku ZIP",
      );
    }
  }

  async function handleImport() {
    if (!zipPath) return;

    setImporting(true);
    setError(null);

    try {
      const newName =
        customName.trim() !== detectedName ? customName.trim() : null;

      await invoke("import_instance", {
        zipPath,
        newName: newName || null,
      });

      setStep("done");
      onImported?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nie udało się zaimportować instancji",
      );
    } finally {
      setImporting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setStep("select");
      setError(null);
      setZipPath(null);
      setDetectedName("");
      setCustomName("");
      setNeedsMigration(false);
    }
    onOpenChange(open);
  }

  function handleViewDashboard() {
    handleClose(false);
    navigate("/");
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Importuj instancję"}
            {step === "confirm" && "Potwierdź import"}
            {step === "done" && "Import zakończony"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" &&
              "Wybierz plik ZIP z instancją Minecraft do zaimportowania."}
            {step === "confirm" &&
              `Znaleziono instancję: ${detectedName}`}
            {step === "done" && "Instancja została pomyślnie zaimportowana!"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Select step */}
          {step === "select" && (
            <div className="flex justify-center">
              <Button onClick={handleSelectFile} disabled={importing}>
                {importing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                    Sprawdzanie pliku...
                  </>
                ) : (
                  "Wybierz plik ZIP"
                )}
              </Button>
            </div>
          )}

          {/* Confirm step */}
          {step === "confirm" && (
            <>
              {needsMigration && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                  Manifest instancji wymaga migracji — zostanie automatycznie
                  zaktualizowany podczas importu.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="import-name">
                  Nazwa instancji (możesz zmienić)
                </Label>
                <Input
                  id="import-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={64}
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Importing spinner */}
          {importing && step === "confirm" && (
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <span className="text-sm text-muted-foreground">
                Wypakowywanie instancji...
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "select" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Anuluj
            </Button>
          )}

          {step === "confirm" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("select");
                  setError(null);
                }}
                disabled={importing}
              >
                Wstecz
              </Button>
              <Button onClick={handleImport} disabled={importing || !customName.trim()}>
                {importing ? "Importowanie..." : "Importuj"}
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleViewDashboard}>
              Przejdź do Dashboardu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportInstanceDialog;
