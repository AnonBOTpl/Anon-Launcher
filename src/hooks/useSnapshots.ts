/**
 * React hook for snapshot management (TASK-23 + TASK-24).
 */

import { useState, useEffect, useCallback } from "react";
import * as snapshotApi from "@/lib/snapshot";
import i18n from "@/lib/i18n";
import type { SnapshotInfo, RestoreResult } from "@/lib/snapshot";

interface UseSnapshotsReturn {
  snapshots: SnapshotInfo[];
  loading: boolean;
  error: string | null;
  creating: boolean;
  restoring: boolean;
  refresh: () => Promise<void>;
  create: (mode: "full" | "metadata") => Promise<SnapshotInfo>;
  remove: (timestamp: string) => Promise<void>;
  restore: (
    timestamp: string,
    mode: "full" | "metadata",
  ) => Promise<RestoreResult>;
}

export function useSnapshots(instanceName: string): UseSnapshotsReturn {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const refresh = useCallback(async () => {
    if (!instanceName) return;
    setLoading(true);
    setError(null);
    try {
      const list = await snapshotApi.listSnapshots(instanceName);
      setSnapshots(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("snapshots.loadError"));
    } finally {
      setLoading(false);
    }
  }, [instanceName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (mode: "full" | "metadata"): Promise<SnapshotInfo> => {
      setCreating(true);
      try {
        const info = await snapshotApi.createSnapshot(instanceName, mode);
        await refresh();
        return info;
      } finally {
        setCreating(false);
      }
    },
    [instanceName, refresh],
  );

  const remove = useCallback(
    async (timestamp: string) => {
      await snapshotApi.deleteSnapshot(instanceName, timestamp);
      await refresh();
    },
    [instanceName, refresh],
  );

  const restore = useCallback(
    async (timestamp: string, mode: "full" | "metadata"): Promise<RestoreResult> => {
      setRestoring(true);
      try {
        const result = await snapshotApi.restoreSnapshot(
          instanceName,
          timestamp,
          mode,
        );
        return result;
      } finally {
        setRestoring(false);
      }
    },
    [instanceName],
  );

  return {
    snapshots,
    loading,
    error,
    creating,
    restoring,
    refresh,
    create,
    remove,
    restore,
  };
}
