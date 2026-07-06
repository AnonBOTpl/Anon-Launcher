/**
 * Frontend API for mod installation (TASK-20).
 * Delegates to Tauri backend commands.
 */

import { invoke } from "@tauri-apps/api/core";

export interface InstalledMod {
  name: string;
  versionId: string;
  fileName: string;
  enabled: boolean;
  installedAt: string;
  projectSlug?: string;
  iconUrl?: string | null;
}

/** Download and install a mod from Modrinth into an instance's mods folder. */
export async function installMod(
  instanceName: string,
  versionId: string,
  downloadUrl: string,
  fileName: string,
  modName: string,
  projectSlug?: string,
  iconUrl?: string | null,
): Promise<InstalledMod> {
  return invoke<InstalledMod>("install_mod", {
    instanceName,
    versionId,
    downloadUrl,
    fileName,
    modName,
    projectSlug,
    iconUrl,
  });
}

/** List all installed mods for an instance. */
export async function listMods(instanceName: string): Promise<InstalledMod[]> {
  return invoke<InstalledMod[]>("list_mods", { instanceName });
}

/** Toggle a mod's enabled/disabled state. */
export async function toggleMod(
  instanceName: string,
  fileName: string,
  enabled: boolean,
): Promise<InstalledMod> {
  return invoke<InstalledMod>("toggle_mod", {
    instanceName,
    fileName,
    enabled,
  });
}

/** Remove a mod (delete file + remove from registry). */
export async function removeMod(
  instanceName: string,
  fileName: string,
): Promise<void> {
  return invoke<void>("remove_mod", { instanceName, fileName });
}
