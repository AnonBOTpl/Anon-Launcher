/**
 * Frontend API for snapshot management (TASK-23 + TASK-24).
 */

import { invoke } from "@tauri-apps/api/core";

export interface SnapshotInfo {
  timestamp: string;
  mode: "full" | "metadata";
  sizeBytes: number;
  modCount: number;
  createdAt: string;
  label: string;
}

export interface RestoreResult {
  restoredManifest: boolean;
  restoredMods: boolean;
  warning: string | null;
}

/** Create a snapshot of an instance. */
export async function createSnapshot(
  instanceName: string,
  mode: "full" | "metadata",
): Promise<SnapshotInfo> {
  return invoke<SnapshotInfo>("create_snapshot", {
    instanceName,
    mode,
  });
}

/** List all snapshots for an instance. */
export async function listSnapshots(
  instanceName: string,
): Promise<SnapshotInfo[]> {
  return invoke<SnapshotInfo[]>("list_snapshots", { instanceName });
}

/** Delete a snapshot. */
export async function deleteSnapshot(
  instanceName: string,
  timestamp: string,
): Promise<void> {
  return invoke<void>("delete_snapshot", { instanceName, timestamp });
}

/** Restore from a snapshot. */
export async function restoreSnapshot(
  instanceName: string,
  timestamp: string,
  mode: "full" | "metadata",
): Promise<RestoreResult> {
  return invoke<RestoreResult>("restore_snapshot", {
    instanceName,
    timestamp,
    mode,
  });
}

/** Format bytes to human-readable size. */
export function formatSnapshotSize(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
