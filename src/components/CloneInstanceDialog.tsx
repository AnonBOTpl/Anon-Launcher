import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCloneInstance } from "@/hooks/useCloneInstance";
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

interface CloneInstanceDialogProps {
  /** The name of the instance to clone */
  sourceName: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Called after successful clone */
  onCloned?: () => void;
}

const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

function CloneInstanceDialog({
  sourceName,
  open,
  onOpenChange,
  onCloned,
}: CloneInstanceDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clone, cloning, error, clearError } = useCloneInstance();
  const [newName, setNewName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setNewName("");
      setValidationError(null);
      clearError();
    }
    onOpenChange(newOpen);
  }

  function validate(): boolean {
    const trimmed = newName.trim();

    if (!trimmed) {
      setValidationError(t("clone.errors.nameRequired"));
      return false;
    }

    if (trimmed.length < 2) {
      setValidationError(t("clone.errors.nameMinLength"));
      return false;
    }

    if (trimmed.length > 64) {
      setValidationError(t("clone.errors.nameMaxLength"));
      return false;
    }

    if (FORBIDDEN_CHARS.test(trimmed)) {
      setValidationError(t("create.errors.nameForbiddenChars"));
      return false;
    }

    if (trimmed.toLowerCase() === sourceName.toLowerCase()) {
      setValidationError(t("clone.errors.nameMustDiffer"));
      return false;
    }

    setValidationError(null);
    return true;
  }

  async function handleClone() {
    if (!validate()) return;

    try {
      await clone(sourceName, newName.trim());
      handleOpenChange(false);
      onCloned?.();
      navigate(`/instance/${encodeURIComponent(newName.trim())}`);
    } catch {
      // Error is handled by the hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("clone.title")}</DialogTitle>
          <DialogDescription>
            {t("clone.description", { sourceName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="clone-name">{t("clone.newName")}</Label>
            <Input
              id="clone-name"
              placeholder={t("clone.namePlaceholder")}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setValidationError(null);
                clearError();
              }}
              maxLength={64}
              className={validationError || error ? "border-destructive" : ""}
              autoFocus
            />
            {validationError && (
              <p className="text-xs text-destructive">{validationError}</p>
            )}
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={cloning}
          >
            {t("clone.cancel")}
          </Button>
          <Button onClick={handleClone} disabled={cloning || !newName.trim()}>
            {cloning ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                {t("clone.cloning")}
              </>
            ) : (
              t("clone.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CloneInstanceDialog;
