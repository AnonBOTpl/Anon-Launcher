import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getProject, getProjectVersions, formatDownloads } from "@/lib/modrinth";
import type { ModrinthProject, ModrinthVersion } from "@/types/modrinth";
import type { ModpackProgressEvent } from "@/types/content";
import { getIconIdentifier } from "@/lib/instanceIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImportFromLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

type Step = "input" | "preview" | "installing" | "done" | "error";

function ImportFromLinkDialog({ open, onOpenChange, onImported }: ImportFromLinkDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ModrinthVersion | null>(null);
  const [instanceName, setInstanceName] = useState("");

  // Install progress
  const [progress, setProgress] = useState<ModpackProgressEvent | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const unlisteners = useRef<(() => void)[]>([]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      unlisteners.current.forEach((fn) => fn());
      unlisteners.current = [];
    };
  }, []);

  /** Parse Modrinth URL to extract slug */
  function parseModrinthUrl(input: string): string | null {
    const trimmed = input.trim();

    // Direct slug (no URL)
    if (/^[a-z0-9_-]+$/i.test(trimmed) && !trimmed.includes(".") && !trimmed.includes("/")) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      const parts = parsed.pathname.replace(/\/+$/, "").split("/");
      if (parts.length >= 3 && parts[2]) {
        return parts[2];
      }
    } catch {
      // Not a valid URL
    }

    return null;
  }

  async function handleFetch() {
    setError(null);
    const slug = parseModrinthUrl(url);
    if (!slug) {
      setError(t("importFromLink.invalidUrl"));
      return;
    }

    setLoading(true);
    try {
      const proj = await getProject(slug);
      setProject(proj);
      setInstanceName(proj.title);

      const vers = await getProjectVersions(slug);
      const filtered = proj.project_type === "modpack"
        ? vers.filter((v) => v.loaders.includes("fabric") || v.loaders.includes("neoforge"))
        : vers;

      setVersions(filtered);
      if (filtered.length > 0) {
        const release = filtered.find((v) => v.version_type === "release")
          ?? filtered[filtered.length - 1]
          ?? filtered[0];
        if (release) setSelectedVersion(release);
      }

      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modrinth.api.apiErrorSimple", { status: 0 }));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!project || !selectedVersion) return;
    setError(null);
    setLoading(true);
    setStep("installing");

    const primaryFile = selectedVersion.files.find((f) => f.primary)
      ?? selectedVersion.files[0];
    if (!primaryFile) {
      setError(t("importFromLink.noFiles"));
      setLoading(false);
      return;
    }

    // Clean old listeners
    unlisteners.current.forEach((fn) => fn());
    unlisteners.current = [];

    try {
      // Listen for progress
      const unlistenProgress = await listen<ModpackProgressEvent>(
        "modpack:progress",
        (event) => setProgress(event.payload),
      );
      unlisteners.current.push(unlistenProgress);

      // Listen for done
      const unlistenDone = await listen<{ instanceName: string }>(
        "modpack:done",
        () => {
          setLoading(false);
          setStep("done");
          onImported?.();
        },
      );
      unlisteners.current.push(unlistenDone);

      // Listen for error
      const unlistenError = await listen<{ message: string }>(
        "modpack:error",
        (event) => {
          setLoading(false);
          setCancelling(false);
          // If cancelled by user, go back to input cleanly
          if (event.payload.message === "Cancelled") {
            setStep("input");
            setError(null);
            setProgress(null);
          } else {
            setError(event.payload.message);
            setStep("error");
          }
        },
      );
      unlisteners.current.push(unlistenError);

      // Start the modpack installation
      await invoke("create_instance_from_modpack", {
        input: {
          name: instanceName || project.title,
          modpackUrl: primaryFile.url,
          modpackName: project.title,
          modpackVersionId: selectedVersion.id,
          ram: 4096,
          javaVersion: "21",
          customJavaPath: null,
          jvmArgs: null,
          icon: project.icon_url ? getIconIdentifier("url", project.icon_url) : null,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
      setLoading(false);
      setStep("error");
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await invoke("cancel_modpack_installation");
    } catch {
      // If invoke fails, just reset state
      setCancelling(false);
      setStep("input");
      setError(null);
      setProgress(null);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Block closing on outside click during preview/installing/error
      if (step === "installing" || step === "preview") return;
      // Reset state when actually closing
      setStep("input");
      setUrl("");
      setError(null);
      setProject(null);
      setVersions([]);
      setSelectedVersion(null);
      setInstanceName("");
      setProgress(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" showCloseButton={step !== "installing"}>
        <DialogHeader>
          <DialogTitle>
            {step === "input" && t("importFromLink.title")}
            {step === "preview" && t("importFromLink.preview")}
            {(step === "installing") && t("importFromLink.installing")}
            {step === "done" && t("importFromLink.done")}
            {step === "error" && t("importFromLink.installError")}
          </DialogTitle>
          <DialogDescription>
            {step === "input" && t("importFromLink.description")}
            {step === "preview" && t("importFromLink.previewDesc")}
            {step === "installing" && t("create.installingModpackDesc")}
            {step === "done" && t("importFromLink.doneDesc")}
            {step === "error" && (error ?? t("common.unknownError"))}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* ── Step 1: URL Input ── */}
          {step === "input" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="modrinth-url">{t("importFromLink.urlLabel")}</Label>
                <Input
                  id="modrinth-url"
                  placeholder="https://modrinth.com/modpack/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleFetch(); }}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  {t("importFromLink.urlHint")}
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleFetch}
                  disabled={loading || !url.trim()}
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      {t("common.loading")}
                    </>
                  ) : (
                    t("importFromLink.check")
                  )}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && project && (
            <>
              {/* Project header */}
              <div className="flex items-start gap-3">
                {project.icon_url ? (
                  <img
                    src={project.icon_url}
                    alt={project.title}
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-border/50"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-border/50">
                    <span className="text-lg font-bold text-primary">
                      {project.title.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate">{project.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {project.author} · {formatDownloads(project.downloads)} {t("modDetails.downloads")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {project.loaders.slice(0, 2).map((l) => (
                      <span key={l} className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">
                        {l}
                      </span>
                    ))}
                    {project.game_versions.slice(0, 2).map((v) => (
                      <span key={v} className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Instance name */}
              <div className="space-y-2">
                <Label htmlFor="instance-name-link">{t("create.name")}</Label>
                <Input
                  id="instance-name-link"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  maxLength={64}
                />
              </div>

              {/* Version select */}
              {versions.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("modpackSearch.select")}</Label>
                  <select
                    value={selectedVersion?.id ?? ""}
                    onChange={(e) => {
                      const v = versions.find((ver) => ver.id === e.target.value);
                      if (v) setSelectedVersion(v);
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version_number}
                        {v.version_type !== "release" ? ` (${v.version_type})` : ""}
                        {" — "}{v.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Version info banner */}
              {selectedVersion && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-xs text-emerald-400/80">
                    {t("modpackSearch.instanceCreatedWith", {
                      mcVersion: selectedVersion.game_versions[0] ?? "?",
                      loader: selectedVersion.loaders[0] ?? "fabric",
                      version: selectedVersion.version_number,
                    })}
                  </p>
                </div>
              )}

              {/* Description preview */}
              {project.description && (
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {project.description}
                  </p>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep("input"); setError(null); }}
                >
                  {t("common.back")}
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={loading || !instanceName.trim() || !selectedVersion}
                >
                  {t("importFromLink.create")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Installing ── */}
          {step === "installing" && (
            <div className="space-y-3 py-4">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300"
                  style={{
                    width: progress?.total && progress.total > 0
                      ? `${Math.round((Math.min(progress.current, progress.total) / progress.total) * 100)}%`
                      : "100%",
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {cancelling ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary shrink-0" />
                ) : (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary shrink-0" />
                )}
                <span className="truncate max-w-[320px]">
                  {cancelling ? t("common.cancelling") : (progress?.message ?? t("create.preparing"))}
                </span>
              </div>
              {!cancelling && progress?.phase === "downloading_files" && progress.total > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {progress.current}/{progress.total}
                </p>
              )}
              {/* Cancel button */}
              {!cancelling && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-1.5"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    {t("common.cancel")}
                  </Button>
                </div>
              )}
              {cancelling && (
                <div className="flex justify-center">
                  <p className="text-xs text-muted-foreground">
                    {t("importFromLink.cancellingDesc")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="text-sm text-emerald-400/80 text-center">{t("importFromLink.doneDesc")}</p>
              <Button onClick={() => handleClose(false)}>
                {t("import.goToDashboard")}
              </Button>
            </div>
          )}

          {/* ── Error ── */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-destructive text-center">{error ?? t("common.unknownError")}</p>
              <Button variant="outline" onClick={() => { setStep("input"); setError(null); }}>
                {t("common.back")}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImportFromLinkDialog;
