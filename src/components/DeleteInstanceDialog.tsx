import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
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

interface DeleteInstanceDialogProps {
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

function DeleteInstanceDialog({
  instanceName,
  open,
  onOpenChange,
  onDeleted,
}: DeleteInstanceDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmName === instanceName;

  function resetState() {
    setConfirmName("");
    setError(null);
  }

  async function handleDelete() {
    if (!isConfirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await invoke("delete_instance", { instanceName });
      onOpenChange(false);
      resetState();
      onDeleted?.();
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("delete.errors.deleteFailed"),
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) resetState();
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {t("delete.title")}
          </DialogTitle>
          <DialogDescription className="space-y-3">
            <p>
              {t("delete.description", { instanceName })}
            </p>
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <p className="font-medium">{t("delete.irreversible")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("delete.confirmHint")}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              {t("delete.confirmLabel", { instanceName })}
            </Label>
            <Input
              id="confirm-delete"
              placeholder={instanceName}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className={error ? "border-destructive" : ""}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={deleting}
          >
            {t("delete.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
          >
            {deleting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                {t("delete.deleting")}
              </>
            ) : (
              t("delete.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteInstanceDialog;
