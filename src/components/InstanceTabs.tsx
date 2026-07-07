import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import type { InstanceManifest } from "@/types/instance";
import ModList from "@/components/ModList";
import SnapshotList from "@/components/SnapshotList";

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  { id: "gra", label: "Gra" },
  { id: "mody", label: "Mody" },
  { id: "snapshoty", label: "Snapshoty" },
  { id: "logi", label: "Logi" },
  { id: "profil", label: "Profil" },
];

function tabContent(
  tabId: string,
  instanceName: string | null,
  instanceMcVersion: string | undefined,
): React.ReactNode {
  switch (tabId) {
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
    case "logi":
      return (
        <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">
            Podgląd logów — zostanie zaimplementowany w TASK-26.
          </p>
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
}

function InstanceTabs() {
  const { id } = useParams<{ id: string }>();
  const instanceName = id ? decodeURIComponent(id) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "gra";
  const [instanceMcVersion, setInstanceMcVersion] = useState<string | undefined>(undefined);

  // Read instance manifest to get MC version
  useEffect(() => {
    if (!instanceName) {
      setInstanceMcVersion(undefined);
      return;
    }
    let cancelled = false;
    invoke<{ manifest: InstanceManifest }>("read_manifest", { instanceName })
      .then((result) => {
        if (!cancelled) {
          setInstanceMcVersion(result.manifest.mcVersion);
        }
      })
      .catch(() => {
        if (!cancelled) setInstanceMcVersion(undefined);
      });
    return () => { cancelled = true; };
  }, [instanceName]);

  const setActiveTab = (tabId: string) => {
    setSearchParams(
      tabId === "gra" ? {} : { tab: tabId },
      { replace: true }
    );
  };

  return (
    <div>
      {/* Underline tabs */}
      <div className="flex border-b border-border/50">
        {TABS.map((tab) => {
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
        {tabContent(activeTab, instanceName, instanceMcVersion)}
      </div>
    </div>
  );
}

export default InstanceTabs;
