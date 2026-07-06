import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-16 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
