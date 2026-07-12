import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { InstanceManifest } from "@/types/instance";
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
import { Separator } from "@/components/ui/separator";
import VersionSelect from "@/components/VersionSelect";
import LoaderSelect from "@/components/LoaderSelect";
import { getJavaVersionForMc } from "@/lib/java";

interface EditInstanceDialogProps {
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const MAX_NAME_LENGTH = 64;

/** Human-readable Java version names */
const JAVA_LABELS: Record<string, string> = {
  "8": "Java 8",
  "11": "Java 11",
  "17": "Java 17",
  "21": "Java 21",
  "25": "Java 25",
};

function EditInstanceDialog({
  instanceName,
  open,
  onOpenChange,
  onUpdated,
}: EditInstanceDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form fields
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState<"vanilla" | "fabric" | "neoforge">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [javaVersion, setJavaVersion] = useState("21");
  const [ram, setRam] = useState(4096);
  const [jvmArgs, setJvmArgs] = useState("");

  // Java recommendation based on MC version
  const recommendedJava = mcVersion ? getJavaVersionForMc(mcVersion) : null;
  const javaMismatch =
    recommendedJava && javaVersion !== recommendedJava
      ? t("edit.javaMismatch", { mcVersion, javaLabel: JAVA_LABELS[recommendedJava] ?? `Java ${recommendedJava}` })
      : null;

  // Auto-update Java when MC version changes (only if not manually set)
  const [javaAutoSet, setJavaAutoSet] = useState(true);
  useEffect(() => {
    if (recommendedJava && javaAutoSet) {
      setJavaVersion(recommendedJava);
    }
  }, [recommendedJava, javaAutoSet]);

  // Load current manifest when dialog opens
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);
    setFieldErrors({});
    setJavaAutoSet(true);

    invoke<{ manifest: InstanceManifest }>("read_manifest", {
      instanceName,
    })
      .then((result) => {
        const m = result.manifest;
        setName(m.name);
        setMcVersion(m.mcVersion);
        setLoader(m.loader);
        setLoaderVersion(m.loaderVersion);
        setJavaVersion(m.javaVersion);
        setRam(m.ram);
        setJvmArgs(m.jvmArgs ?? "");
        // Don't auto-override saved Java version on dialog open
        setJavaAutoSet(false);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : t("edit.errors.loadFailed")
        );
        setLoading(false);
      });
  }, [open, instanceName]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();

    if (!trimmed) {
      errors.name = t("create.errors.nameRequired");
    } else if (trimmed.length > MAX_NAME_LENGTH) {
      errors.name = t("create.errors.nameMaxLength", { max: MAX_NAME_LENGTH });
    } else if (FORBIDDEN_CHARS.test(trimmed)) {
      errors.name = t("create.errors.nameForbiddenChars");
    } else if (trimmed.length < 2) {
      errors.name = t("create.errors.nameMinLength");
    }

    if (!mcVersion) {
      errors.mcVersion = t("create.errors.mcVersionRequired");
    }

    if ((loader === "fabric" || loader === "neoforge") && !loaderVersion) {
      errors.loaderVersion = t("create.errors.loaderVersionRequired");
    }

    if (!Number.isFinite(ram) || ram < 1024) {
      errors.ram = t("create.errors.ramMin");
    } else if (ram > 65536) {
      errors.ram = t("create.errors.ramMax");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      await invoke("update_instance", {
        oldName: instanceName,
        newManifest: {
          schemaVersion: 1,
          name: name.trim(),
          mcVersion,
          loader,
          loaderVersion,
          javaVersion,
          ram,
          jvmArgs: jvmArgs.trim() || null,
          createdAt: "", // backend sets this
          updatedAt: "", // backend sets this
        },
      });

      onOpenChange(false);
      onUpdated?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("edit.errors.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
          <DialogDescription>
            {t("edit.description")}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : error && !fieldErrors.name ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Instance name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("create.name")}</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                className={fieldErrors.name ? "border-destructive" : ""}
              />
              {fieldErrors.name && (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              )}
            </div>

            <Separator />

            {/* MC Version — dropdown z listą wersji */}
            <VersionSelect
              value={mcVersion}
              onChange={(v) => {
                setMcVersion(v);
                setJavaAutoSet(true);
              }}
              error={fieldErrors.mcVersion}
            />
            <p className="text-xs text-muted-foreground -mt-3">
              {t("edit.versionChangeHint")}
            </p>

            {/* Loader + Loader version */}
            <LoaderSelect
              loader={loader}
              loaderVersion={loaderVersion}
              mcVersion={mcVersion}
              onLoaderChange={setLoader}
              onLoaderVersionChange={setLoaderVersion}
              error={fieldErrors.loaderVersion}
            />

            <Separator />

            {/* RAM slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-ram">{t("create.ram")}</Label>
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {(ram / 1024).toFixed(1)} GB
                </span>
              </div>
              <input
                id="edit-ram"
                type="range"
                min={1024}
                max={16384}
                step={512}
                value={ram}
                onChange={(e) => setRam(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 GB</span>
                <span>16 GB</span>
              </div>
              {fieldErrors.ram && (
                <p className="text-xs text-destructive">{fieldErrors.ram}</p>
              )}
            </div>

            {/* Java version */}
            <div className="space-y-2">
              <Label htmlFor="edit-java">{t("create.java")}</Label>
              <select
                id="edit-java"
                value={javaVersion}
                onChange={(e) => {
                  setJavaVersion(e.target.value);
                  setJavaAutoSet(false);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="8">Java 8</option>
                <option value="11">Java 11</option>
                <option value="17">Java 17</option>
                <option value="21">Java 21</option>
                <option value="25">Java 25</option>
              </select>

              {/* Java/MC version mismatch warning */}
              {javaMismatch && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  {javaMismatch}
                </p>
              )}
            </div>

            {/* JVM Arguments */}
            <div className="space-y-2">
              <Label htmlFor="edit-jvm">{t("create.jvmArgs")}</Label>
              <Input
                id="edit-jvm"
                placeholder="-Dfml.ignoreInvalidMinecraftCertificates=true"
                value={jvmArgs}
                onChange={(e) => setJvmArgs(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
              {t("create.jvmArgsDesc")}
            </p>
            </div>

            {/* Error display */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("edit.cancel")}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/80 hover:to-primary text-white shadow-lg shadow-primary/20"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                {t("edit.saving")}
              </>
            ) : (
              t("edit.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditInstanceDialog;
