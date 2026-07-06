import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
        err instanceof Error ? err.message : "Nie udało się otworzyć folderu";
      setError(message);
    } finally {
      setOpening(false);
    }
  }, []);

  return { openFolder, opening, error };
}
