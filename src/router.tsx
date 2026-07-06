import { createHashRouter } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import InstanceView from "@/pages/InstanceView";
import CreateInstance from "@/pages/CreateInstance";
import ConsoleWindow from "@/pages/ConsoleWindow";

export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "/create",
        element: <CreateInstance />,
      },
      {
        path: "/instance/:id",
        element: <InstanceView />,
      },
    ],
  },
  // Standalone console window — no sidebar, no layout
  {
    path: "/console/:id",
    element: <ConsoleWindow />,
  },
]);
