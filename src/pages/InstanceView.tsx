export interface DownloadProgress {
  phase: "client" | "libraries" | "natives" | "assets";
  current: number;
  total: number;
  status: string;
}

import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { InstanceManifest } from "@/types/instance";
import HeroCard from "@/components/HeroCard";
import InstanceTabs from "@/components/InstanceTabs";
import { useLaunch } from "@/hooks/useLaunch";
import { useCrashReports } from "@/hooks/useCrashReports";
import { getJavaVersionForMc, getJavaPath, downloadJava, getJavaLabel } from "@/lib/java";
import { resolveVersion, getDownloadList } from "@/lib/version-resolver";
import { generateLaunchArgs } from "@/lib/minecraft-core";
import { tryRefreshSession } from "@/lib/accounts";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

function InstanceView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const instanceName = id ? decodeURIComponent(id) : null;

  const [manifest, setManifest] = useState<InstanceManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status: launchStatus, launch, stop, logs, clearLogs } = useLaunch(instanceName ?? undefined);
  const crashReportsHook = useCrashReports(instanceName ?? undefined);
  const [canLaunch, setCanLaunch] = useState(true);
  const [launching, setLaunching] = useState(false);
  const { t } = useTranslation();
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [gameDir, setGameDir] = useState("");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [crashBannerDismissed, setCrashBannerDismissed] = useState(false);
  const [, setSearchParams] = useSearchParams();
  // Quick Play: server address set by QuickPlay component, consumed by handleLaunch
  const quickPlayServerRef = useRef<{ ip: string; port?: number } | null>(null);

  // Fetch game directory from backend for path construction
  useEffect(() => {
    async function fetchGameDir() {
      try {
        // The generated launch args need to match backend paths.
        // Backend computes gameDir internally, so we use appDataDir as base
        // for generateLaunchArgs to construct consistent classpath paths.
        const { appDataDir } = await import("@tauri-apps/api/path");
        const dir = await appDataDir();
        setGameDir(dir);
      } catch {
        setGameDir("./game");
      }
    }
    fetchGameDir();
  }, []);

  // Helper: wait for a download phase to complete (via events)
  const waitForDownload = useCallback(async (phase: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      let unlistenComplete: UnlistenFn | null = null;
      let unlistenError: UnlistenFn | null = null;

      listen<{ phase: string }>("download:complete", (event) => {
        if (event.payload.phase === phase) {
          unlistenComplete?.();
          unlistenError?.();
          resolve();
        }
      }).then(fn => { unlistenComplete = fn; });

      listen<{ phase: string; message: string }>("download:error", (event) => {
        if (event.payload.phase === phase) {
          unlistenComplete?.();
          unlistenError?.();
          reject(new Error(event.payload.message));
        }
      }).then(fn => { unlistenError = fn; });
    });
  }, []);

  // Listen for download events from backend
  // These persist across component re-mounts to handle navigation during download
  useEffect(() => {
    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    async function setup() {
      // Download progress — also locks the launch button
      const unlistenProgress = await listen<DownloadProgress>("download:progress", (event) => {
        if (!cancelled) {
          setDownloadProgress(event.payload);
          setLaunching(true);
        }
      });
      unlisteners.push(unlistenProgress);

      // Download error — unlock button and show error
      const unlistenError = await listen<{ phase: string; message: string }>("download:error", (event) => {
        if (!cancelled) {
          setDownloadProgress(null);
          setLaunching(false);
          setLaunchError(event.payload.message);
        }
      });
      unlisteners.push(unlistenError);
    }

    setup();

    return () => {
      cancelled = true;
      for (const fn of unlisteners) {
        fn();
      }
    };
  }, []);

  // Determine if we can launch (Java available?)
  // Note: button is never disabled — auto-download handles missing Java in handleLaunch.
  // The disabledReason prop is used for informational messages only.
  useEffect(() => {
    if (!manifest) return;
    const mcVer = manifest.mcVersion;
    
    async function checkPrerequisites() {
      try {
        const javaVer = getJavaVersionForMc(mcVer);
        await getJavaPath(javaVer);
        setCanLaunch(true);
      } catch {
        // Java not installed — auto-download will handle this during launch
        setCanLaunch(true);
      }
    }
    checkPrerequisites();
  }, [manifest?.mcVersion]);

  /** Sanitize instance name the same way the backend does */
  function sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();
  }

  // Launch handler
  const handleLaunch = useCallback(async () => {
    if (!manifest || !instanceName) return;

    setLaunchError(null);
    setLaunching(true);
    // Show initial preparing state
    setDownloadProgress({ phase: "client", current: 0, total: 1, status: t("launch.preparing") });

    try {
      const javaVersion = getJavaVersionForMc(manifest.mcVersion);

      // ── Auto-download Java if not installed ────────────────────
      let javaPath: string;
      try {
        javaPath = manifest.customJavaPath || await getJavaPath(javaVersion);
      } catch {
        // Java not installed — auto-download it
        setDownloadProgress({ phase: "client", current: 0, total: 1, status: `Downloading ${getJavaLabel(javaVersion)}...` });
        const dlStatus = await downloadJava(javaVersion);
        if (!dlStatus.success) {
          throw new Error(dlStatus.error || `Failed to download Java ${javaVersion}`);
        }
        javaPath = dlStatus.path!;
      }

      // Resolve version from Mojang API (with Fabric loader if applicable)
      const loaderArg = manifest.loader === "fabric"
        ? { type: "fabric" as const, version: manifest.loaderVersion }
        : manifest.loader === "neoforge"
          ? { type: "neoforge" as const, version: manifest.loaderVersion }
          : undefined;

      if (loaderArg && !loaderArg.version) {
        setDownloadProgress(null);
        setLaunchError(
          manifest.loader === "neoforge"
            ? t("errors.noNeoForgeVersion")
            : t("errors.noFabricVersion")
        );
        return;
      }

      const resolved = await resolveVersion(manifest.mcVersion, loaderArg);

      // Compute per-instance game directory
      // Backend computes: $APP_DATA/instances/<sanitized_name>/
      const baseDir = gameDir.replace(/[\\/]$/, "");
      const instanceDir = baseDir + "/instances/" + sanitizeName(instanceName);

      // Get download lists
      const { libraries, clientJar } = getDownloadList(resolved);

      // ── Background download sequence ─────────────────────────────
      // Each invoke starts the download in a background thread and returns
      // immediately. We wait for the completion event before proceeding.
      // IMPORTANT: Set up event listeners BEFORE calling invoke to avoid
      // race conditions where the thread finishes before listeners register.

      // Download client jar
      setDownloadProgress({ phase: "client", current: 0, total: 2, status: t("launch.downloadingClient") });
      const dlClient = waitForDownload("client");
      invoke("download_client_jar", {
        mcVersion: manifest.mcVersion,
        url: clientJar.url,
        expectedSize: clientJar.size,
      });
      await dlClient;

      // Download regular libraries (backend stores in $APP_DATA/libraries/)
      if (libraries.length > 0) {
        const dlLibs = waitForDownload("libraries");
        invoke("download_libraries", { libraries });
        await dlLibs;
      }

      // Download native libraries and extract DLLs/.so from JARs
      const { natives } = getDownloadList(resolved);
      if (natives.length > 0) {
        const dlNatives = waitForDownload("libraries");
        invoke("download_libraries", { libraries: natives });
        await dlNatives;
        // Extract to global $APP_DATA/natives/ (shared between instances)
        const extractNatives = waitForDownload("natives");
        invoke("extract_natives", {
          natives: natives.map((n: { path: string }) => ({ jarPath: n.path })),
          gameDir: baseDir,
        });
        await extractNatives;
      }

      // Download assets (index + objects)
      setDownloadProgress({ phase: "assets", current: 0, total: 1, status: t("launch.downloadingAssets") });
      const dlAssets = waitForDownload("assets");
      invoke("download_assets", { index: resolved.assetIndex });
      await dlAssets;

      // Get active account session — auto-odświeża token jeśli wygasł
      const session = await tryRefreshSession();
      if (!session) {
        setDownloadProgress(null);
        setLaunchError(t("errors.loginRequired"));
        return;
      }

      // Check for Quick Play server address (set by QuickPlay component)
      const serverAddress = quickPlayServerRef.current;
      quickPlayServerRef.current = null; // consume the value

      // Generate launch arguments
      const args = generateLaunchArgs({
        javaPath,
        gameDir: instanceDir,  // per-instance: saves, mods, configs go here
        librariesBase: baseDir,  // global: libraries, assets, versions
        version: resolved,
        auth: {
          username: session.username,
          uuid: session.uuid,
          accessToken: session.accessToken,
          xuid: session.xuid,
          userType: "msa",
        },
        memory: manifest.ram,
        jvmArgs: manifest.jvmArgs,
        ...(serverAddress ? { server: serverAddress } : {}),
      });

      // Launch — backend uses same instance dir as working directory
      // Clear download progress — actual launch starting
      setDownloadProgress(null);
      await launch(instanceName, javaPath, args);
    } catch (err) {
      // Quick Play ref cleanup on error too
      quickPlayServerRef.current = null;
      // Tauri invoke może rzucać Error, string, lub obiekt z "message"
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else if (err && typeof err === "object" && "message" in err) {
        message = String((err as { message: unknown }).message);
      } else {
        message = String(err) || t("errors.unknown");
      }
      setDownloadProgress(null);
      setLaunchError(message);
      console.error("[Launch Error]", message, "\nFull error:", err);
    } finally {
      setLaunching(false);
    }
  }, [manifest, instanceName, launch, gameDir, t]);

  // Quick Play handler: stores server address and triggers launch
  const handleQuickPlay = useCallback((ip: string, port?: number) => {
    quickPlayServerRef.current = { ip, port };
    handleLaunch();
  }, [handleLaunch]);

  // Load manifest
  useEffect(() => {
    if (!instanceName) {
      setLoading(false);
      setError(t("errors.noInstance"));
      return;
    }

    setLoading(true);
    setError(null);

    invoke<{ manifest: InstanceManifest }>("read_manifest", {
      instanceName,
    })
      .then((result) => {
        setManifest(result.manifest);
        setLoading(false);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : t("errors.loadFailed")
        );
        setLoading(false);
      });
  }, [instanceName]);

  // Refresh after edit — reload to reflect name changes
  const handleUpdated = () => {
    navigate(0);
  };

  // Open console in a separate Tauri window
  const openConsoleWindow = useCallback(async () => {
    const name = instanceName ?? "unknown";
    // Sanitize label — Tauri window labels only allow [a-zA-Z0-9._-]
    const label = "console-" + name.replace(/[^a-zA-Z0-9._-]/g, "_");
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) {
        existing.setFocus();
        return;
      }
    } catch {
      // Window doesn't exist
    }
    const url = `/#/console/${encodeURIComponent(name)}`;
    const webview = new WebviewWindow(label, {
      url,
      title: `${t("console.title")} - ${name}`,
      width: 800,
      height: 600,
      minWidth: 500,
      minHeight: 300,
      center: true,
    });
    webview.once("tauri://error", () => {
      console.error("Failed to create console window");
    });
  }, [instanceName]);

  // Auto-switch to crash tab when new crash detected
  useEffect(() => {
    if (crashReportsHook.hasNewCrash && crashReportsHook.reports.length > 0) {
      setSearchParams({ tab: "crash" }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crashReportsHook.hasNewCrash]);

  // After delete — go back to dashboard
  const handleDeleted = () => {
    navigate("/");
  };

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center animate-page-enter">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">{t("dashboard.loading")}</p>
        </div>
      </div>
    );
  }

  // --- Error / Not found state ---
  if (error || !manifest) {
    return (
      <div className="min-h-full flex items-center justify-center p-8 animate-page-enter">
        <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border/50 px-12 py-16 max-w-md text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">{t("instance.notFound")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || t("instance.notFoundHint", { name: instanceName })}
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t("instance.backToDashboard")}
          </button>
        </div>
      </div>
    );
  }

  // --- Normal view ---
  return (
    <div className="min-h-full flex flex-col animate-page-enter">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
        <button
          onClick={() => navigate("/")}
          className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors backdrop-blur-sm"
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
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t("instance.back")}
        </button>

        {/* Empty spacer to keep Powrót left-aligned */}
        <div />
      </div>

      {/* Content area */}
      <div className="flex-1 p-8 pt-6 space-y-8">
        {/* Download progress bar */}
        {downloadProgress && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-primary animate-pulse"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {downloadProgress.status}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-300 ease-out"
                    style={{
                      width: downloadProgress.total > 0
                        ? `${Math.min(100, Math.round((downloadProgress.current / downloadProgress.total) * 100))}%`
                        : "0%",
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {downloadProgress.current} / {downloadProgress.total}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Launch error banner */}
        {launchError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0 text-destructive"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">{t("launch.launchError")}</p>
                <p className="mt-1 text-sm text-destructive/80">{launchError}</p>
              </div>
              <button
                onClick={() => setLaunchError(null)}
                className="shrink-0 rounded-lg p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Hero card */}
        <HeroCard
          instance={manifest}
          launchStatus={launchStatus}
          onLaunch={handleLaunch}
          onStop={() => stop(instanceName!)}
          canLaunch={canLaunch && !launching}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onOpenConsole={openConsoleWindow}
          onQuickPlay={handleQuickPlay}
        />

        {/* Crash banner — shows after a new crash is detected */}
        {crashReportsHook.hasNewCrash && !crashBannerDismissed && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-destructive"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                  <path d="M12 2v4" />
                  <path d="m4.93 4.93 2.83 2.83" />
                  <path d="M2 12h4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  {t("crash.detected")}
                </p>
                <p className="mt-0.5 text-sm text-destructive/80">
                  {t("crash.detectedCount", { count: crashReportsHook.reports.length })}
                  {crashReportsHook.selectedReport
                    ? t("crash.viewDetails")
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setSearchParams({ tab: "crash" }, { replace: true });
                    setCrashBannerDismissed(true);
                    crashReportsHook.dismissNewCrash();
                    // Auto-select first report if none selected
                    if (
                      !crashReportsHook.selectedReport &&
                      crashReportsHook.reports.length > 0
                    ) {
                      crashReportsHook.selectReport(crashReportsHook.reports[0]?.filename ?? null);
                    }
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-destructive/20 px-3 text-xs font-medium text-destructive hover:bg-destructive/30 transition-colors"
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
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  {t("crash.viewDetails")}
                </button>
                <button
                  onClick={() => setCrashBannerDismissed(true)}
                  className="shrink-0 rounded-lg p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instance tabs — pass crash report state and running status */}
        <InstanceTabs
          logs={logs}
          onClearLogs={clearLogs}
          hasNewCrash={crashReportsHook.hasNewCrash}
          onDismissNewCrash={() => {
            crashReportsHook.dismissNewCrash();
            setCrashBannerDismissed(true);
          }}
          isRunning={launchStatus.type === "running"}
        />
      </div>
    </div>
  );
}

export default InstanceView;
