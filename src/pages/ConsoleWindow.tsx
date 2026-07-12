import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GameConsole } from "@/components/GameConsole";
import { useLaunch } from "@/hooks/useLaunch";
import type { InstanceManifest } from "@/types/instance";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * Standalone console window — displayed in a separate Tauri window.
 * Has no sidebar, no navigation — just the GameConsole component
 * streaming logs from the specified instance.
 */
export default function ConsoleWindow() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const instanceName = id ? decodeURIComponent(id) : null;

  const { logs, clearLogs } = useLaunch(instanceName ?? undefined);
  const [instanceTitle, setInstanceTitle] = useState(instanceName ?? t("console.title"));

  // Fetch instance name for the window title
  useEffect(() => {
    if (!instanceName) return;
    invoke<{ manifest: InstanceManifest }>("read_manifest", { instanceName })
      .then((result) => setInstanceTitle(result.manifest.name || instanceName))
      .catch(() => setInstanceTitle(instanceName));
  }, [instanceName]);

  // If no instance name, show error
  if (!instanceName) {
    return (
      <div className="min-h-screen bg-[#1E1E1E] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-400 font-mono text-sm">{t("errors.noInstance")}</p>
          <button
            onClick={() => getCurrentWindow().close()}
            className="mt-4 text-xs text-[#888] hover:text-[#CCC] transition-colors font-mono"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1E1E1E] flex flex-col">
      {/* Minimal top bar with instance name and close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-xs font-mono text-[#CCC]">
            {instanceTitle} — {t("console.title")}
          </span>
          <span className="text-[10px] text-[#666]">
            ({logs.length} {t("console.lines")})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-[10px] text-[#666] hover:text-[#CCC] transition-colors font-mono px-2 py-1 rounded hover:bg-[#333]"
          >
            {t("console.clear")}
          </button>
        </div>
      </div>

      {/* Game console fills remaining space */}
      <div className="flex-1 p-2">
        <GameConsole
          logs={logs}
          onClear={clearLogs}
          maxHeight="100%"
        />
      </div>
    </div>
  );
}
