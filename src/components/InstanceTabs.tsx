import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  { id: "gra", label: "Gra" },
  { id: "mody", label: "Mody" },
  { id: "logi", label: "Logi" },
  { id: "profil", label: "Profil" },
];

const TAB_CONTENT: Record<string, React.ReactNode> = {
  gra: (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">
        Ustawienia gry — zostanie zaimplementowane w TASK-13.
      </p>
    </div>
  ),
  mody: (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">
        Menedżer modów — zostanie zaimplementowany w TASK-20.
      </p>
    </div>
  ),
  logi: (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">
        Podgląd logów — zostanie zaimplementowany w TASK-26.
      </p>
    </div>
  ),
  profil: (
    <div className="rounded-2xl border border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
      <p className="text-sm text-muted-foreground">
        Profil gracza — zostanie zaimplementowany w TASK-27.
      </p>
    </div>
  ),
};

function InstanceTabs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "gra";

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
        {TAB_CONTENT[activeTab] ?? TAB_CONTENT.gra}
      </div>
    </div>
  );
}

export default InstanceTabs;
