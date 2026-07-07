import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import type { InstanceManifest } from "@/types/instance";
import type { LogLine } from "@/hooks/useLaunch";
import ModList from "@/components/ModList";
import ContentList from "@/components/ContentList";
import SnapshotList from "@/components/SnapshotList";
import { GameConsole } from "@/components/GameConsole";
import * as modApi from "@/lib/mod-installer";
import { getProject, getProjectVersions } from "@/lib/modrinth";

interface Tab {
  id: string;
  label: string;
}

interface InstanceTabsProps {
  logs?: LogLine[];
  onClearLogs?: () => void;
}

const TABS: Tab[] = [
  { id: "gra", label: "Gra" },
  { id: "mody", label: "Mody" },
  { id: "resourcepacks", label: "Paczki zasobów" },
  { id: "shaders", label: "Shadery" },
  { id: "snapshoty", label: "Snapshoty" },
  { id: "logi", label: "Logi" },
  { id: "profil", label: "Profil" },
];

function InstanceTabs({ logs = [], onClearLogs }: InstanceTabsProps) {
  const { id } = useParams<{ id: string }>();
  const instanceName = id ? decodeURIComponent(id) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "gra";
  const [instanceMcVersion, setInstanceMcVersion] = useState<string | undefined>(undefined);
  const [instanceLoader, setInstanceLoader] = useState<string | undefined>(undefined);
  const [irisInstalled, setIrisInstalled] = useState<boolean | undefined>(undefined);

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstanceMcVersion(undefined);
          setInstanceLoader(undefined);
        }
      });
    return () => { cancelled = true; };
  }, [instanceName]);

  // Check if Iris is installed (only when shader tab is active or on loader change)
  const checkIris = useCallback(async () => {
    if (!instanceName || !instanceLoader || instanceLoader === "vanilla") {
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

    // Fetch Iris project info
    const irisProject = await getProject("iris");
    // Fetch versions matching Fabric + instance MC version
    const irisVersions = await getProjectVersions("iris", {
      loaders: ["fabric"],
      gameVersions: [instanceMcVersion],
    });

    if (irisVersions.length === 0) {
      throw new Error("Nie znaleziono wersji Iris dla Minecraft " + instanceMcVersion);
    }

    // Pick latest release version (array is non-empty at this point)
    const irisVersion = irisVersions.find((v) => v.version_type === "release") ?? irisVersions[0];
    if (!irisVersion) {
      throw new Error("Nie znaleziono pasującej wersji Iris");
    }
    const irisFile = irisVersion.files.find((f) => f.primary) ?? irisVersion.files[0];
    if (!irisFile) {
      throw new Error("Nie znaleziono pliku do pobrania dla Iris");
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
  }, [instanceName, instanceMcVersion, checkIris]);

  // Filter tabs by loader
  const visibleTabs = TABS.filter((tab) => {
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
              <ModList instanceName={instanceName} instanceMcVersion={instanceMcVersion} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Wybierz instancję, aby zarządzać modami.
              </p>
            )}
          </div>
        );
      case "resourcepacks":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <ContentList instanceName={instanceName} folder="resourcepacks" />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Wybierz instancję, aby zarządzać paczkami zasobów.
              </p>
            )}
          </div>
        );
      case "shaders":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-6 backdrop-blur-sm">
            {instanceName ? (
              <ContentList
                instanceName={instanceName}
                folder="shaderpacks"
                irisInstalled={irisInstalled}
                onInstallIris={handleInstallIris}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Wybierz instancję, aby zarządzać shaderpackami.
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
              <SnapshotList instanceName={instanceName} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Wybierz instancję, aby zarządzać snapshotami.
              </p>
            )}
          </div>
        );
      case "profil":
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Profil gracza — zostanie zaimplementowany w TASK-27.
            </p>
          </div>
        );
      default:
        return (
          <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Ustawienia gry.
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
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-5 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-purple-500" />
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
