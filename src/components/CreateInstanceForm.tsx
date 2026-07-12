import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CreateInstanceInput } from "@/types/instance";
import type { ModpackProgressEvent } from "@/types/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import VersionSelect from "@/components/VersionSelect";
import LoaderSelect from "@/components/LoaderSelect";
import JavaSettings from "@/components/JavaSettings";
import ModpackSearch from "@/components/ModpackSearch";
import type { ModpackSelection } from "@/components/ModpackSearch";
import IconPicker from "@/components/IconPicker";
import InstanceIcon from "@/components/InstanceIcon";
import { getIconIdentifier } from "@/lib/instanceIcon";
import { getJavaVersionForMc, getJavaPath, downloadJava } from "@/lib/java";
import { useJavaRuntime } from "@/hooks/useJavaRuntime";

type CreationMode = "manual" | "modpack";

interface FormErrors {
  name?: string;
  mcVersion?: string;
  loader?: string;
  loaderVersion?: string;
  ram?: string;
  general?: string;
}

const FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const MAX_NAME_LENGTH = 64;

function CreateInstanceForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Mode toggle
  const [creationMode, setCreationMode] = useState<CreationMode>("manual");

  // Manual form state
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState<"vanilla" | "fabric" | "neoforge">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");

  // Shared form state
  const [javaVersion, setJavaVersion] = useState("21");
  const [customJavaPath, setCustomJavaPath] = useState("");
  const [ram, setRam] = useState(4096);
  const [jvmArgs, setJvmArgs] = useState("");

  // Icon state
  const [icon, setIcon] = useState("");

  // Modpack state
  const [modpackSelection, setModpackSelection] = useState<ModpackSelection | null>(null);

  // Existing instances for duplicate name check
  const [existingNames, setExistingNames] = useState<string[]>([]);
  const [nameTaken, setNameTaken] = useState(false);

  // Load existing instances on mount
  useEffect(() => {
    invoke<{ name: string }[]>("list_instances")
      .then((instances) => setExistingNames(instances.map((i) => i.name.toLowerCase())))
      .catch(() => {});
  }, []);

  // Check name uniqueness on change
  useEffect(() => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length >= 2 && existingNames.includes(trimmed)) {
      setNameTaken(true);
    } else {
      setNameTaken(false);
    }
  }, [name, existingNames]);

  // Modpack progress dialog
  const [modpackProgress, setModpackProgress] = useState<ModpackProgressEvent | null>(null);
  const [modpackInstalling, setModpackInstalling] = useState(false);
  const [modpackError, setModpackError] = useState<string | null>(null);
  const [modpackSuccess, setModpackSuccess] = useState(false);
  const modpackUnlistenRef = useRef<(() => void)[]>([]);

  // NeoForge installation state
  const [neoforgeInstalling, setNeoForgeInstalling] = useState(false);
  const [neoforgeProgress, setNeoForgeProgress] = useState<string | null>(null);
  const [neoforgeStep, setNeoForgeStep] = useState<number>(0);
  const [neoforgeError, setNeoForgeError] = useState<string | null>(null);
  const [neoforgeSuccess, setNeoForgeSuccess] = useState(false);
  const neoforgeUnlistenRef = useRef<(() => void)[]>([]);

  // Map of step names to progress percentages (0-100)
  const neoforgeStepProgress: Record<string, number> = {
    preparing: 5,
    download: 20,
    verify_java: 35,
    profile: 45,
    install: 70,
    verify_install: 90,
    done: 100,
  };

  const neoforgeSteps = ["preparing", "download", "verify_java", "profile", "install", "verify_install", "done"];

  const {

    versions,
    downloading,
    downloadStatus,
    startDownload,
  } = useJavaRuntime();

  // Auto-detect Java version when MC version changes (manual mode)
  const recommendedJava = mcVersion ? getJavaVersionForMc(mcVersion) : null;
  useEffect(() => {
    if (recommendedJava) {
      setJavaVersion(recommendedJava);
    }
  }, [recommendedJava]);

  // Handle modpack selection
  const handleModpackSelect = useCallback((selection: ModpackSelection) => {
    setModpackSelection(selection);
    setName(selection.modpackName);
  }, []);

  function validateManual(): boolean {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = t("create.errors.nameRequired");
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = t("create.errors.nameMaxLength", { max: MAX_NAME_LENGTH });
    } else if (FORBIDDEN_CHARS.test(trimmedName)) {
      newErrors.name = t("create.errors.nameForbiddenChars");
    } else if (trimmedName.length < 2) {
      newErrors.name = t("create.errors.nameMinLength");
    } else if (existingNames.includes(trimmedName.toLowerCase())) {
      newErrors.name = t("create.errors.nameTaken");
    }

    if (!mcVersion) {
      newErrors.mcVersion = t("create.errors.mcVersionRequired");
    }

    if (loader === "fabric" || loader === "neoforge") {
      if (!loaderVersion) {
        newErrors.loaderVersion = t("create.errors.loaderVersionRequired");
      }
    }

    if (!Number.isFinite(ram) || ram < 1024) {
      newErrors.ram = t("create.errors.ramMin");
    } else if (ram > 65536) {
      newErrors.ram = t("create.errors.ramMax");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateModpack(): boolean {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = t("create.errors.nameRequired");
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = t("create.errors.nameMaxLength", { max: MAX_NAME_LENGTH });
    } else if (FORBIDDEN_CHARS.test(trimmedName)) {
      newErrors.name = t("create.errors.nameForbiddenChars");
    }

    if (!modpackSelection) {
      newErrors.general = t("create.errors.modpackRequired");
    }

    if (!Number.isFinite(ram) || ram < 1024) {
      newErrors.ram = t("create.errors.ramMin");
    } else if (ram > 65536) {
      newErrors.ram = t("create.errors.ramMax");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (creationMode === "manual") {
      if (!validateManual()) return;
    } else {
      if (!validateModpack()) return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      if (creationMode === "manual") {
        const input: CreateInstanceInput = {
          name: name.trim(),
          mcVersion,
          loader,
          loaderVersion,
          javaVersion,
          customJavaPath: customJavaPath.trim() || undefined,
          ram,
          jvmArgs: jvmArgs.trim() || undefined,
          icon: icon || undefined,
        };

        await invoke("create_instance", { input });

        // ── NeoForge: run installer after creating instance ─────────
        if (loader === "neoforge" && mcVersion && loaderVersion) {
          // Determine Java path
          let javaPath: string;
          if (customJavaPath.trim()) {
            javaPath = customJavaPath.trim();
          } else {
            try {
              javaPath = await getJavaPath(javaVersion);
            } catch {
              // Java not installed locally — download it first
              setNeoForgeProgress("Pobieranie Java " + javaVersion + "...");
              setNeoForgeStep(2);
              try {
                const dlStatus = await downloadJava(javaVersion);
                if (!dlStatus.success) {
                  setNeoForgeError(dlStatus.error || "Failed to download Java " + javaVersion);
                  setNeoForgeInstalling(false);
                  return;
                }
                javaPath = dlStatus.path!;
              } catch (dlErr) {
                const msg = dlErr instanceof Error ? dlErr.message : "Failed to download Java";
                setNeoForgeError(msg);
                setNeoForgeInstalling(false);
                return;
              }
            }
          }

          // Clean up old listeners
          neoforgeUnlistenRef.current.forEach((fn) => fn());
          neoforgeUnlistenRef.current = [];

          // Reset progress state
          setNeoForgeProgress(null);
          setNeoForgeStep(0);
          setNeoForgeError(null);
          setNeoForgeSuccess(false);
          setNeoForgeInstalling(true);

          // Subscribe to progress events
          const unlistenProgress = await listen<{ step: string; message: string }>(
            "neoforge:progress",
            (event) => {
              setNeoForgeProgress(event.payload.message);
              const stepIdx = neoforgeSteps.indexOf(event.payload.step);
              if (stepIdx >= 0) setNeoForgeStep(stepIdx + 1);
            },
          );
          neoforgeUnlistenRef.current.push(unlistenProgress);

          // Subscribe to done event
          const unlistenDone = await listen<{ versionId: string }>(
            "neoforge:done",
            () => {
              setNeoForgeSuccess(true);
              setTimeout(() => {
                setNeoForgeInstalling(false);
                navigate("/");
              }, 1500);
            },
          );
          neoforgeUnlistenRef.current.push(unlistenDone);

          // Subscribe to error event
          const unlistenError = await listen<{ message: string }>(
            "neoforge:error",
            (event) => {
              setNeoForgeError(event.payload.message);
              setNeoForgeInstalling(false);
            },
          );
          neoforgeUnlistenRef.current.push(unlistenError);

          // Start the background installation (returns immediately)
          await invoke("install_neoforge_loader", {
            mcVersion,
            neoforgeVersion: loaderVersion,
            javaPath,
          });

          return; // Don't navigate — events handle it
        }
      } else {
        // Modpack mode — show progress dialog (async via events)
        if (!modpackSelection) {
          setErrors({ general: t("create.errors.modpackRequired") });
          setSubmitting(false);
          return;
        }

        // Clean up old listeners
        modpackUnlistenRef.current.forEach((fn) => fn());
        modpackUnlistenRef.current = [];

        // Reset progress state
        setModpackProgress(null);
        setModpackError(null);
        setModpackSuccess(false);
        setModpackInstalling(true);

        // Subscribe to progress events
        const unlistenProgress = await listen<ModpackProgressEvent>(
          "modpack:progress",
          (event) => {
            setModpackProgress(event.payload);
          },
        );
        modpackUnlistenRef.current.push(unlistenProgress);

        // Subscribe to done event
        const unlistenDone = await listen<{ instanceName: string }>(
          "modpack:done",
          () => {
            setModpackSuccess(true);
            // Auto-navigate after success
            setTimeout(() => {
              setModpackInstalling(false);
              navigate("/");
            }, 1500);
          },
        );
        modpackUnlistenRef.current.push(unlistenDone);

        // Subscribe to error event
        const unlistenError = await listen<{ message: string }>(
          "modpack:error",
          (event) => {
            setModpackError(event.payload.message);
            setModpackInstalling(false);
          },
        );
        modpackUnlistenRef.current.push(unlistenError);

        // Start the background installation (returns immediately)
        await invoke("create_instance_from_modpack", {
          input: {
            name: name.trim(),
            modpackUrl: modpackSelection.modpackUrl,
            modpackName: modpackSelection.modpackName,
            modpackVersionId: modpackSelection.modpackVersionId,
            ram,
            javaVersion,
            customJavaPath: customJavaPath.trim() || undefined,
            jvmArgs: jvmArgs.trim() || undefined,
            icon: modpackSelection.modpackIconUrl
              ? getIconIdentifier("url", modpackSelection.modpackIconUrl)
              : undefined,
          },
        });

        return; // Don't navigate — events handle it
      }

      // Navigate back to dashboard on success (manual mode)
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("create.errors.createFailed");
      setErrors({ general: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* General error */}
      {errors.general && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {errors.general}
        </div>
      )}

      {/* Mode toggle */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setCreationMode("manual");
                setModpackSelection(null);
              }}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                creationMode === "manual"
                  ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
                {t("create.manualConfig")}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCreationMode("modpack")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                creationMode === "modpack"
                  ? "bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                {t("create.fromModpack")}
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Basic info — name is always shown */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">              <h3 className="text-sm font-medium leading-none">
              {creationMode === "manual" ? t("create.basicInfo") : t("create.modpackInfo")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {creationMode === "manual"
                ? t("create.basicInfoDesc")
                : t("create.modpackInfoDesc")
            }
            </p>
          </div>
          <Separator />

          {/* Instance name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">{t("create.name")}</Label>
            <div className="relative">
              <Input
                id="instance-name"
                placeholder={creationMode === "manual" ? t("create.namePlaceholder") : t("create.nameModpackPlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                className={(errors.name || nameTaken) ? "border-destructive pr-8" : ""}
              />
              {nameTaken && (
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive"
                >
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              )}
            </div>
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
            {nameTaken && !errors.name && (
              <p className="text-xs text-destructive">{t("create.errors.nameTaken")}</p>
            )}
          </div>

          {/* Manual mode: VersionSelect + LoaderSelect */}
          {creationMode === "manual" && (
            <>
              <VersionSelect
                value={mcVersion}
                onChange={setMcVersion}
                error={errors.mcVersion}
              />
            </>
          )}

          {/* Modpack mode: ModpackSearch */}
          {creationMode === "modpack" && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-4">
              <ModpackSearch onSelect={handleModpackSelect} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual mode only: Loader selection */}
      {creationMode === "manual" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-medium leading-none">{t("create.loader")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("create.loaderDesc")}
              </p>
            </div>
            <Separator />

            <LoaderSelect
              loader={loader}
              loaderVersion={loaderVersion}
              mcVersion={mcVersion}
              onLoaderChange={setLoader}
              onLoaderVersionChange={setLoaderVersion}
              error={errors.loaderVersion}
            />
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium leading-none">{t("create.configuration")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("create.configurationDesc")}
            </p>
          </div>
          <Separator />

          {/* RAM slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ram">{t("create.ram")}</Label>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {(ram / 1024).toFixed(1)} GB
              </span>
            </div>
            <input
              id="ram"
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
            {errors.ram && <p className="text-xs text-destructive">{errors.ram}</p>}
          </div>

          {/* Java version */}
          <div className="space-y-2">
            <Label>{t("create.java")}</Label>
            <JavaSettings
              versions={versions}
              value={javaVersion}
              onChange={setJavaVersion}
              customPath={customJavaPath}
              onCustomPathChange={setCustomJavaPath}
              onDownload={startDownload}
              isDownloading={downloading === javaVersion}
              downloadError={downloadStatus?.success === false ? downloadStatus.error : null}
            />
            {downloadStatus?.success && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                <p className="text-xs text-emerald-400">
                  ✓ {t("create.javaDownloaded", { version: downloadStatus.version })}
                </p>
              </div>
            )}
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <Label>{t("create.icon") ?? "Icon"}</Label>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 ring-1 ring-primary/10">
                {icon ? <InstanceIcon instance={{ name, icon }} size={22} /> : <span className="text-sm font-bold text-muted-foreground">?</span>}
              </div>
              <div className="flex-1">
                <IconPicker value={icon} onChange={setIcon} showRandom />
              </div>
            </div>
          </div>

          {/* JVM Arguments */}
          <div className="space-y-2">
            <Label htmlFor="jvm-args">{t("create.jvmArgs")}</Label>
            <Input
              id="jvm-args"
              placeholder="-Dfml.ignoreInvalidMinecraftCertificates=true"
              value={jvmArgs}
              onChange={(e) => setJvmArgs(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("create.jvmArgsDesc")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/")}
          disabled={submitting}
        >
          {t("create.cancel")}
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              {creationMode === "manual" ? t("create.creating") : t("create.downloadingModpack")}
            </>
          ) : (
            creationMode === "manual" ? t("create.submit") : t("create.submitModpack")
          )}
        </Button>
      </div>

      {/* ── NeoForge installation progress dialog ───────────────── */}
      <Dialog
        open={neoforgeInstalling || neoforgeSuccess || !!neoforgeError}
        onOpenChange={(open) => {
          if (!neoforgeInstalling && !open) {
            setNeoForgeInstalling(false);
            setNeoForgeProgress(null);
            setNeoForgeStep(0);
            setNeoForgeError(null);
            setNeoForgeSuccess(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!neoforgeInstalling}>
          <DialogHeader>
            <DialogTitle>
              {neoforgeError
                ? t("loader.neoforgeInstallError")
                : neoforgeSuccess
                  ? t("loader.neoforgeInstalled")
                  : t("loader.neoforgeInstalling")}
            </DialogTitle>
            <DialogDescription>
              {t("loader.neoforgeInstallDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {neoforgeError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{neoforgeError}</span>
                </div>
              </div>
            )}

            {neoforgeSuccess && (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  {t("loader.neoforgeInstalled")}
                </div>
              </div>
            )}

            {neoforgeInstalling && (
              <div className="space-y-3 py-2">
                {/* Step indicator */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("create.step")} {neoforgeStep}/{neoforgeSteps.length}</span>
                  <span>{neoforgeStepProgress[neoforgeSteps[neoforgeStep - 1] ?? "preparing"] ?? 0}%</span>
                </div>

                {/* Progress bar with dynamic width */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-700 ease-out"
                    style={{ width: `${neoforgeStepProgress[neoforgeSteps[neoforgeStep - 1] ?? "preparing"] ?? 5}%` }}
                  />
                </div>

                {/* Step name indicators */}
                <div className="flex justify-between px-0.5">
                  {neoforgeSteps.map((step, idx) => (
                    <div key={step} className="flex flex-col items-center gap-1" style={{ width: `${100 / neoforgeSteps.length}%` }}>
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-all duration-300",
                          idx + 1 <= neoforgeStep
                            ? "bg-sky-400 shadow-sm shadow-sky-400/50"
                            : "bg-muted-foreground/20",
                        )}
                      />
                    </div>
                  ))}
                </div>

                {/* Status text */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin shrink-0 rounded-full border-2 border-muted border-t-sky-500" />
                  <span className="truncate max-w-[320px]">
                    {neoforgeProgress ?? t("create.preparing")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modpack installation progress dialog ──────────────────── */}
      <Dialog
        open={modpackInstalling || modpackSuccess || !!modpackError}
        onOpenChange={(open) => {
          // Allow closing only when not installing (success or error)
          if (!modpackInstalling && !open) {
            setModpackInstalling(false);
            setModpackProgress(null);
            setModpackError(null);
            setModpackSuccess(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!modpackInstalling}>
          <DialogHeader>
            <DialogTitle>
              {modpackError
                ? t("create.modpackError")
                : modpackSuccess
                  ? t("create.modpackDone")
                  : t("create.installingModpack")}
            </DialogTitle>
            <DialogDescription>
              {modpackError
                ? t("create.modpackErrorDesc")
                : modpackSuccess
                  ? t("create.modpackDoneDesc")
                  : t("create.installingModpackDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {modpackError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{modpackError}</span>
                </div>
              </div>
            )}

            {modpackSuccess && (
              <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  {t("create.modpackRedirect")}
                </div>
              </div>
            )}

            {modpackInstalling && (
              <div className="space-y-3 py-2">
                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300 ease-out",
                      modpackProgress?.phase === "downloading_modpack" || modpackProgress?.phase === "parsing"
                        ? "bg-primary animate-pulse"
                        : "bg-gradient-to-r from-primary to-primary/80",
                    )}
                    style={{
                      width: modpackProgress?.total && modpackProgress.total > 0
                        ? `${Math.round((Math.min(modpackProgress.current, modpackProgress.total) / modpackProgress.total) * 100)}%`
                        : "100%",
                    }}
                  />
                </div>

                {/* Status text */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                    <div className="h-4 w-4 animate-spin shrink-0 rounded-full border-2 border-muted border-t-primary" />
                    <span className="truncate max-w-[280px]">
                      {modpackProgress?.message ?? t("create.preparing")}
                    </span>
                  </div>
                  {modpackProgress?.phase === "downloading_files" && modpackProgress.total > 0 && (
                    <span className="text-muted-foreground tabular-nums shrink-0 ml-2">
                      {modpackProgress.current}/{modpackProgress.total}
                    </span>
                  )}
                </div>

                {/* Cancel button */}
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await invoke("cancel_modpack_installation");
                      } catch {
                        // Ignore errors
                      }
                    }}
                    className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                    {t("create.cancelInstall")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

export default CreateInstanceForm;
