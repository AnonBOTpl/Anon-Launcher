import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/i18n";

interface UseOpenFolderResult {
  openFolder: (instanceName: string) => Promise<void>;
  opening: boolean;
  error: string | null;
}

export function useOpenFolder(): UseOpenFolderResult {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFolder = useCallback(async (instanceName: string) => {
    setOpening(true);
    setError(null);

    try {
      await invoke("open_instance_folder", { instanceName });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : i18n.t("errors.folderOpenFailed");
      setError(message);
    } finally {
      setOpening(false);
    }
  }, []);

  return { openFolder, opening, error };
}
