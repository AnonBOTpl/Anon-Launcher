import i18n from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { InstanceManifest } from "@/types/instance";

interface UseInstancesResult {
  instances: InstanceManifest[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useInstances(): UseInstancesResult {
  const [instances, setInstances] = useState<InstanceManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<InstanceManifest[]>("list_instances");
      setInstances(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return {
    instances,
    loading,
    error,
    refresh: fetchInstances,
  };
}
