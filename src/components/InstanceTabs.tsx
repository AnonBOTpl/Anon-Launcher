import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import type { InstanceManifest } from "@/types/instance";
import type { LogLine } from "@/hooks/useLaunch";
import { useCrashReports } from "@/hooks/useCrashReports";
import { CrashReportList } from "@/components/CrashReportList";
import ModList from "@/components/ModList";
import ContentList from "@/components/ContentList";
import SnapshotList from "@/components/SnapshotList";
import { GameConsole } from "@/components/GameConsole";
import GameOverview from "@/components/GameOverview";
import * as modApi from "@/lib/mod-installer";
import { getProject, getProjectVersions } from "@/lib/modrinth";


interface InstanceTabsProps {
  logs?: LogLine[];
  onClearLogs?: () => void;
  /** Whether a new crash was detected (shows badge on Crash tab) */
  hasNewCrash?: boolean;
  /** Dismiss new crash indicator */
  onDismissNewCrash?: () => void;
  /** Whether the game is currently running — disable mod/resource management */
  isRunning?: boolean;
}

function InstanceTabs({ logs = [], onClearLogs, hasNewCrash, onDismissNewCrash, isRunning }: InstanceTabsProps) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const instanceName = id ? decodeURIComponent(id) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "gra";
  const [instanceMcVersion, setInstanceMcVersion] = useState<string | undefined>(undefined);
  const [instanceLoader, setInstanceLoader] = useState<string | undefined>(undefined);
  const [instanceManifest, setInstanceManifest] = useState<InstanceManifest | undefined>(undefined);
  const [irisInstalled, setIrisInstalled] = useState<boolean | undefined>(undefined);
  const [modUpdatesFound, setModUpdatesFound] = useState(false);

  // Read instance manifest to get MC version and loader type
  useEffect(() => {
    if (!instanceName) {
      setInstanceMcVersion(undefined);
      setInstanceLoader(undefined);
      setIrisInstalled(undefined);
      return;
    }
    let cancelled = false;
    invoke<{ manifest: InstanceManifest }>("read_manifest", { instanceName })
      .then((result) => {
        if (!cancelled) {
          setInstanceMcVersion(result.manifest.mcVersion);
          setInstanceLoader(result.manifest.loader);
          setInstanceManifest(result.manifest);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstanceMcVersion(undefined);
          setInstanceLoader(undefined);
        }
      });
    return () => { cancelled = true; };
  }, [instanceName]);      // Check if Iris is installed (only when shader tab is active or on loader change)
      // NeoForge uses Oculus instead of Iris, so skip this check for NeoForge instances
  const checkIris = useCallback(async () => {
    if (!instanceName || !instanceLoader || instanceLoader === "vanilla" || instanceLoader === "neoforge") {
      setIrisInstalled(undefined);
      return;
    }
    try {
      const mods = await modApi.listMods(instanceName);
      const hasIris = mods.some(
        (m) => m.projectSlug === "iris" || m.name.toLowerCase().includes("iris"),
      );
      setIrisInstalled(hasIris);
    } catch {
      setIrisInstalled(undefined);
    }
  }, [instanceName, instanceLoader]);

  // Check Iris when shader tab becomes active or loader changes
  useEffect(() => {
    if (activeTab === "shaders" && instanceName && instanceLoader && instanceLoader !== "vanilla") {
      checkIris();
    }
  }, [activeTab, instanceName, instanceLoader, checkIris]);

  // Handle installing Iris
  const handleInstallIris = useCallback(async () => {
    if (!instanceName || !instanceMcVersion) return;

    // ── Step 1: Ensure Sodium is installed (Iris requires it) ──────
    const mods = await modApi.listMods(instanceName);
    const hasSodium = mods.some(
      (m) => m.projectSlug === "sodium" || m.name.toLowerCase().includes("sodium"),
    );

    if (!hasSodium) {
      // Fetch + install Sodium first
      const sodiumProject = await getProject("sodium");
      const sodiumVersions = await getProjectVersions("sodium", {
        loaders: ["fabric"],
        gameVersions: [instanceMcVersion],
      });
      if (sodiumVersions.length > 0) {
        const sodiumVersion = sodiumVersions.find((v) => v.version_type === "release") ?? sodiumVersions[0];
        const sodiumFile = sodiumVersion?.files.find((f) => f.primary) ?? sodiumVersion?.files[0];
        if (sodiumFile && sodiumVersion) {
          await modApi.installMod(
            instanceName,
            sodiumVersion.id,
            sodiumVersion.version_number,
            sodiumFile.url,
            sodiumFile.filename,
            sodiumProject.title,
            sodiumProject.slug,
            sodiumProject.icon_url,
          );
        }
      }
    }

    // ── Step 2: Fetch + install Iris ──────────────────────────────
    const irisProject = await getProject("iris");
    // Fetch versions matching Fabric + instance MC version
    const irisVersions = await getProjectVersions("iris", {
      loaders: ["fabric"],
      gameVersions: [instanceMcVersion],
    });

    if (irisVersions.length === 0) {
      throw new Error(t("instance.iris.noVersionForMc", { mcVersion: instanceMcVersion }));
    }

    // Pick latest release version (array is non-empty at this point)
    const irisVersion = irisVersions.find((v) => v.version_type === "release") ?? irisVersions[0];
    if (!irisVersion) {
      throw new Error(t("instance.iris.noMatchingVersion"));
    }
    const irisFile = irisVersion.files.find((f) => f.primary) ?? irisVersion.files[0];
    if (!irisFile) {
      throw new Error(t("instance.iris.noDownloadFile"));
    }

    await modApi.installMod(
      instanceName,
      irisVersion.id,
      irisVersion.version_number,
      irisFile.url,
      irisFile.filename,
      irisProject.title,
      irisProject.slug,
      irisProject.icon_url,
    );

    // Re-check Iris status
    await checkIris();
  }, [instanceName, instanceMcVersion, checkIris, t]);

  // Filter tabs by loader
  // Crash reports hook (only when we have an instance name)
  const crashReportsHook = useCrashReports(instanceName ?? undefined);

  // When hasNewCrash changes from parent, sync to our dismiss
  // (the parent sets hasNewCrash from the hook, we just display it)

  const tabs = [
    { id: "gra", label: t("instance.tabs.game") },
    { id: "mody", label: t("instance.tabs.mods") },
    { id: "resourcepacks", label: t("instance.tabs.resourcepacks") },
    { id: "shaders", label: t("instance.tabs.shaders") },
    { id: "snapshoty", label: t("instance.tabs.snapshots") },
    { id: "logi", label: t("instance.tabs.logs") },
    { id: "crash", label: t("instance.tabs.crash") },
  ];

  const visibleTabs = tabs.filter((tab) => {
    if (tab.id === "mody" && instanceLoader === "vanilla") return false;
    if (tab.id === "shaders" && instanceLoader === "vanilla") return false;
    return true;
  });

  const setActiveTab = (tabId: string) => {
    setSearchParams(
      tabId === "gra" ? {} : { tab: tabId },
      { replace: true }
    );
  };

  // Render tab content inline to pass props
  const renderTabContent = () => {
    switch (activeTab) {
      case "mody":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <ModList
                instanceName={instanceName}
                instanceMcVersion={instanceMcVersion}
                instanceLoader={instanceLoader}
                onUpdatesFound={setModUpdatesFound}
                disabled={isRunning}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.mods")}
              </p>
            )}
          </div>
        );
      case "resourcepacks":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <ContentList key="resourcepacks" instanceName={instanceName} folder="resourcepacks" disabled={isRunning} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.resourcepacks")}
              </p>
            )}
          </div>
        );
      case "shaders":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <ContentList
                key="shaderpacks"
                instanceName={instanceName}
                folder="shaderpacks"
                instanceLoader={instanceLoader}
                irisInstalled={irisInstalled}
                onInstallIris={handleInstallIris}
                disabled={isRunning}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.shaders")}
              </p>
            )}
          </div>
        );
      case "logi":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-2 backdrop-blur-sm">
            <GameConsole logs={logs} onClear={onClearLogs} maxHeight="400px" />
          </div>
        );
      case "snapshoty":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
                {instanceName ? (
              <SnapshotList instanceName={instanceName} disabled={isRunning} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.snapshots")}
              </p>
            )}
          </div>
        );

      case "crash":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden backdrop-blur-sm">
            {instanceName ? (
              <CrashReportList
                reports={crashReportsHook.reports}
                loading={crashReportsHook.loading}
                error={crashReportsHook.error}
                selectedReport={crashReportsHook.selectedReport}
                selectedContent={crashReportsHook.selectedContent}
                contentLoading={crashReportsHook.contentLoading}
                onSelect={crashReportsHook.selectReport}
                onRefresh={crashReportsHook.refresh}
                onDelete={crashReportsHook.remove}
                onDeleteAll={crashReportsHook.removeAll}
                onOpenFolder={() => {
                  invoke("open_crash_reports_folder", { instanceName });
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.crash")}
              </p>
            )}
          </div>
        );

      case "gra":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <GameOverview
                instanceName={instanceName}
                manifest={instanceManifest ?? null}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("instance.tabs.game")}
              </p>
            )}
          </div>
        );

      default:
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              {t("instance.gameTabPlaceholder")}
            </p>
          </div>
        );
    }
  };

  return (
    <div>
      {/* Underline tabs */}
      <div className="flex border-b border-border/50">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "crash" && hasNewCrash;
          const showModBadge = tab.id === "mody" && modUpdatesFound;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Dismiss new crash badge when opening crash tab
                if (tab.id === "crash" && onDismissNewCrash) {
                  onDismissNewCrash();
                }
              }}
              className={cn(
                "relative px-5 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {showBadge && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
                {showModBadge && (
                  <span className="flex h-2 w-2 rounded-full bg-amber-400" />
                )}
              </span>
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-6 animate-fade-in">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default InstanceTabs;
