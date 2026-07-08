import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useUpdater } from "@/hooks/useUpdater";

function AppLayout() {
  const { update, openRelease } = useUpdater();

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
    </div>
  );
}

export default AppLayout;
