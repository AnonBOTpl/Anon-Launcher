import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import type { CreateInstanceInput } from "@/types/instance";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import VersionSelect from "@/components/VersionSelect";
import LoaderSelect from "@/components/LoaderSelect";
import JavaSettings from "@/components/JavaSettings";
import { getJavaVersionForMc } from "@/lib/java";
import { useJavaRuntime } from "@/hooks/useJavaRuntime";

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

  // Form state
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("");
  const [loader, setLoader] = useState<"vanilla" | "fabric">("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [javaVersion, setJavaVersion] = useState("21");
  const [customJavaPath, setCustomJavaPath] = useState("");
  const [ram, setRam] = useState(4096);
  const [jvmArgs, setJvmArgs] = useState("");

  const {
    versions,
    downloading,
    downloadStatus,
    startDownload,
  } = useJavaRuntime();

  // Auto-detect Java version when MC version changes
  const recommendedJava = mcVersion ? getJavaVersionForMc(mcVersion) : null;
  useEffect(() => {
    if (recommendedJava) {
      setJavaVersion(recommendedJava);
    }
  }, [recommendedJava]);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    // Name validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Nazwa instancji jest wymagana";
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Nazwa może mieć maksymalnie ${MAX_NAME_LENGTH} znaków`;
    } else if (FORBIDDEN_CHARS.test(trimmedName)) {
      newErrors.name =
        "Nazwa zawiera niedozwolone znaki (<>:\"/\\|?*)";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Nazwa musi mieć co najmniej 2 znaki";
    }

    // MC version validation
    if (!mcVersion) {
      newErrors.mcVersion = "Wybierz wersję Minecraft";
    }

    // Loader validation
    if (loader === "fabric") {
      if (!loaderVersion) {
        newErrors.loaderVersion = "Wybierz wersję Fabric loadera";
      }
    }

    // RAM validation
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

    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
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

      {/* Basic info */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-medium leading-none">Podstawowe informacje</h3>
            <p className="text-xs text-muted-foreground">
              Nazwij swoją instancję i wybierz wersję gry
            </p>
          </div>
          <Separator />

          {/* Instance name */}
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nazwa instancji</Label>
            <Input
              id="instance-name"
              placeholder="np. Fabric 1.21 Survival"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Dozwolone znaki: litery, cyfry, spacje, myślniki, podkreślniki i kropki
            </p>
          </div>

          {/* Minecraft version */}
          <VersionSelect
            value={mcVersion}
            onChange={setMcVersion}
            error={errors.mcVersion}
          />
        </CardContent>
      </Card>

      {/* Loader selection */}
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
            {/* Download success feedback */}
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
              Tworzenie...
            </>
          ) : (
            "Utwórz instancję"
          )}
        </Button>
      </div>
    </form>
  );
}

export default CreateInstanceForm;
