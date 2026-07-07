import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { CreateInstanceInput } from "@/types/instance";
import type { CreateFromModpackResult } from "@/types/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import VersionSelect from "@/components/VersionSelect";
import LoaderSelect from "@/components/LoaderSelect";
import JavaSettings from "@/components/JavaSettings";
import ModpackSearch from "@/components/ModpackSearch";
import type { ModpackSelection } from "@/components/ModpackSearch";
import { getJavaVersionForMc } from "@/lib/java";
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
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Mode toggle
  const [creationMode, setCreationMode] = useState<CreationMode>("manual");

  // Manual form state
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState<"vanilla" | "fabric">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");

  // Shared form state
  const [javaVersion, setJavaVersion] = useState("21");
  const [customJavaPath, setCustomJavaPath] = useState("");
  const [ram, setRam] = useState(4096);
  const [jvmArgs, setJvmArgs] = useState("");

  // Modpack state
  const [modpackSelection, setModpackSelection] = useState<ModpackSelection | null>(null);

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
      newErrors.name = "Nazwa instancji jest wymagana";
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Nazwa może mieć maksymalnie ${MAX_NAME_LENGTH} znaków`;
    } else if (FORBIDDEN_CHARS.test(trimmedName)) {
      newErrors.name = "Nazwa zawiera niedozwolone znaki (<>:\"/\\|?*)";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Nazwa musi mieć co najmniej 2 znaki";
    }

    if (!mcVersion) {
      newErrors.mcVersion = "Wybierz wersję Minecraft";
    }

    if (loader === "fabric") {
      if (!loaderVersion) {
        newErrors.loaderVersion = "Wybierz wersję Fabric loadera";
      }
    }

    if (!Number.isFinite(ram) || ram < 1024) {
      newErrors.ram = "RAM musi wynosić co najmniej 1024 MB (1 GB)";
    } else if (ram > 65536) {
      newErrors.ram = "RAM nie może przekraczać 65536 MB (64 GB)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateModpack(): boolean {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Nazwa instancji jest wymagana";
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Nazwa może mieć maksymalnie ${MAX_NAME_LENGTH} znaków`;
    } else if (FORBIDDEN_CHARS.test(trimmedName)) {
      newErrors.name = "Nazwa zawiera niedozwolone znaki (<>:\"/\\|?*)";
    }

    if (!modpackSelection) {
      newErrors.general = "Wybierz paczkę modów";
    }

    if (!Number.isFinite(ram) || ram < 1024) {
      newErrors.ram = "RAM musi wynosić co najmniej 1024 MB (1 GB)";
    } else if (ram > 65536) {
      newErrors.ram = "RAM nie może przekraczać 65536 MB (64 GB)";
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
        };

        await invoke("create_instance", { input });
      } else {
        // Modpack mode
        if (!modpackSelection) {
          setErrors({ general: "Wybierz paczkę modów" });
          setSubmitting(false);
          return;
        }

        const result = await invoke<CreateFromModpackResult>("create_instance_from_modpack", {
          input: {
            name: name.trim(),
            modpackUrl: modpackSelection.modpackUrl,
            modpackName: modpackSelection.modpackName,
            modpackVersionId: modpackSelection.modpackVersionId,
            ram,
            javaVersion,
            customJavaPath: customJavaPath.trim() || undefined,
            jvmArgs: jvmArgs.trim() || undefined,
          },
        });

        if (!result.success) {
          throw new Error("Nie udało się utworzyć instancji z modpacka");
        }
      }

      // Navigate back to dashboard on success
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nie udało się utworzyć instancji";
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
                  ? "bg-purple-500/15 text-purple-400 shadow-sm ring-1 ring-purple-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
                Ręczna konfiguracja
              </div>
            </button>
            <button
              type="button"
              onClick={() => setCreationMode("modpack")}
              className={cn(
                "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                creationMode === "modpack"
                  ? "bg-purple-500/15 text-purple-400 shadow-sm ring-1 ring-purple-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
                Z modpacka
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Basic info — name is always shown */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium leading-none">
              {creationMode === "manual" ? "Podstawowe informacje" : "Instancja z modpacka"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {creationMode === "manual"
                ? "Nazwij swoją instancję i wybierz wersję gry"
                : "Wyszukaj paczkę modów do utworzenia instancji"}
            </p>
          </div>
          <Separator />

          {/* Instance name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nazwa instancji</Label>
            <Input
              id="instance-name"
              placeholder={creationMode === "manual" ? "np. Fabric 1.21 Survival" : "Nazwa z modpacka (możesz zmienić)"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
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
              <h3 className="text-sm font-medium leading-none">Loader</h3>
              <p className="text-xs text-muted-foreground">
                Wybierz typ loadera i jego wersję
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
            <h3 className="text-sm font-medium leading-none">Konfiguracja</h3>
            <p className="text-xs text-muted-foreground">
              Ustawienia pamięci i środowiska
            </p>
          </div>
          <Separator />

          {/* RAM slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ram">Pamięć RAM</Label>
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
            <Label>Wersja Java</Label>
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
                  ✓ Java {downloadStatus.version} pobrana pomyślnie!
                </p>
              </div>
            )}
          </div>

          {/* JVM Arguments */}
          <div className="space-y-2">
            <Label htmlFor="jvm-args">Argumenty JVM (opcjonalne)</Label>
            <Input
              id="jvm-args"
              placeholder="-Dfml.ignoreInvalidMinecraftCertificates=true"
              value={jvmArgs}
              onChange={(e) => setJvmArgs(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Dodatkowe argumenty przekazywane do maszyny wirtualnej Javy
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
          Anuluj
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              {creationMode === "manual" ? "Tworzenie..." : "Pobieranie modpacka..."}
            </>
          ) : (
            creationMode === "manual" ? "Utwórz instancję" : "Utwórz z modpacka"
          )}
        </Button>
      </div>
    </form>
  );
}

export default CreateInstanceForm;
