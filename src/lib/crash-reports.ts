import { invoke } from "@tauri-apps/api/core";

export type CrashType = "JVM" | "Minecraft";

export interface CrashReport {
  filename: string;
  filePath: string;
  crashType: CrashType;
  timestamp: string;
  fileSize: number;
  preview: string;
}

/**
 * List all crash reports for a given instance.
 */
export async function listCrashReports(instanceName: string): Promise<CrashReport[]> {
  return invoke<CrashReport[]>("list_crash_reports", { instanceName });
}

/**
 * Read the full content of a specific crash report file.
 */
export async function readCrashReport(
  instanceName: string,
  filename: string,
): Promise<string> {
  return invoke<string>("read_crash_report", { instanceName, filename });
}

/**
 * Delete a single crash report file.
 */
export async function deleteCrashReport(
  instanceName: string,
  filename: string,
): Promise<void> {
  return invoke<void>("delete_crash_report", { instanceName, filename });
}

/**
 * Delete all crash reports for a given instance.
 * Returns the number of deleted files.
 */
export async function deleteAllCrashReports(
  instanceName: string,
): Promise<number> {
  return invoke<number>("delete_all_crash_reports", { instanceName });
}
