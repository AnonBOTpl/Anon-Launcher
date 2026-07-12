import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import FirstRunWizard from "@/components/FirstRunWizard";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useUpdater } from "@/hooks/useUpdater";
import { initAccent } from "@/lib/accents";

function AppLayout() {
  const { update, openRelease } = useUpdater();
  const [showWizard, setShowWizard] = useState(() => {
    return !localStorage.getItem("anon_first_run_done");
  });

  // Init accent on mount
  useEffect(() => {
    initAccent();
  }, []);

  const handleWizardComplete = () => {
    setShowWizard(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-16 flex-1 flex flex-col">
        {update && (
          <UpdateBanner update={update} onOpenRelease={openRelease} />
        )}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>

      {/* First Run Wizard overlay */}
      {showWizard && <FirstRunWizard onComplete={handleWizardComplete} />}
    </div>
  );
}

export default AppLayout;
