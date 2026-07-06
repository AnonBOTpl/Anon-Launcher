import { useState, useEffect, useCallback } from "react";
import * as modApi from "@/lib/mod-installer";
import type { InstalledMod } from "@/lib/mod-installer";

export function useMods(instanceName: string | null) {
  const [mods, setMods] = useState<InstalledMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!instanceName) return;
    setLoading(true);
    setError(null);
    try {
      const list = await modApi.listMods(instanceName);
      setMods(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się załadować modów");
    } finally {
      setLoading(false);
    }
  }, [instanceName]);

  // Initial load + periodic polling (every 5s) for filesystem changes
  useEffect(() => {
    refresh();

    const interval = setInterval(() => {
      // Silent refresh — don't show loading state for background polls
      if (!instanceName) return;
      modApi.listMods(instanceName).then((mods) => {
        setMods(mods);
        setError(null); // clear stale error from previous failed refresh()
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [instanceName, refresh]);



  const toggle = useCallback(
    async (fileName: string, enabled: boolean) => {
      if (!instanceName) return;
      await modApi.toggleMod(instanceName, fileName, enabled);
      await refresh();
    },
    [instanceName, refresh],
  );

  const remove = useCallback(
    async (fileName: string) => {
      if (!instanceName) return;
      await modApi.removeMod(instanceName, fileName);
      await refresh();
    },
    [instanceName, refresh],
  );

  return {
    mods,
    loading,
    error,
    toggle,
    remove,
    refresh,
  } as const;
}
