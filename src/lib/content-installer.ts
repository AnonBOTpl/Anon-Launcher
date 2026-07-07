/**
 * Frontend API wrapper for content installation (resource packs, shaders) and modpack installation.
 */
import { invoke } from "@tauri-apps/api/core";
import type { InstalledContent, CreateFromModpackResult } from "@/types/content";

// ─── Content (Resource Packs / Shaders) ─────────────────────────────

/** Install a content file (resource pack or shader) to an instance */
export async function installContent(
  instanceName: string,
  folder: "resourcepacks" | "shaderpacks",
  fileName: string,
  downloadUrl: string,
  title?: string | null,
  versionId?: string | null,
  versionNumber?: string | null,
  projectSlug?: string | null,
  iconUrl?: string | null,
): Promise<InstalledContent> {
  return invoke<InstalledContent>("install_instance_content", {
    instanceName,
    folder,
    fileName,
    downloadUrl,
    title,
    versionId,
    versionNumber,
    projectSlug,
    iconUrl,
  });
}

/** List installed content files in an instance's folder */
export async function listContent(
  instanceName: string,
  folder: "resourcepacks" | "shaderpacks",
): Promise<InstalledContent[]> {
  return invoke<InstalledContent[]>("list_instance_content", {
    instanceName,
    folder,
  });
}

/** Remove a content file from an instance's folder */
export async function removeContent(
  instanceName: string,
  folder: "resourcepacks" | "shaderpacks",
  fileName: string,
): Promise<void> {
  return invoke<void>("remove_instance_content", {
    instanceName,
    folder,
    fileName,
  });
}

// ─── Modpacks ───────────────────────────────────────────────────────

/** Input for creating an instance from a modpack */
export interface CreateFromModpackInput {
  name: string;
  modpackUrl: string;
  modpackName: string;
  modpackVersionId: string;
  ram: number;
  javaVersion: string;
  customJavaPath?: string;
  jvmArgs?: string;
}

/** Create a new instance from a Modrinth modpack (.mrpack) */
export async function createInstanceFromModpack(
  input: CreateFromModpackInput,
): Promise<CreateFromModpackResult> {
  return invoke<CreateFromModpackResult>("create_instance_from_modpack", { input });
}
