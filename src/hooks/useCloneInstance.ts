import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/i18n";
import type { InstanceManifest } from "@/types/instance";

interface UseCloneInstanceResult {
  clone: (sourceName: string, newName: string) => Promise<InstanceManifest>;
  cloning: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCloneInstance(): UseCloneInstanceResult {
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clone = useCallback(async (sourceName: string, newName: string) => {
    setCloning(true);
    setError(null);

    try {
      const result = await invoke<InstanceManifest>("clone_instance", {
        sourceName,
        newName,
      });
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : i18n.t("clone.errors.cloneFailed");
      setError(message);
      throw new Error(message);
    } finally {
      setCloning(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { clone, cloning, error, clearError };
}
