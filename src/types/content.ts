/** Types for content items (resource packs, shaders) managed per-instance */

export interface InstalledContent {
  fileName: string;
  size: number;
  modifiedAt: string;
}

/** Progress event from modpack installation */
export interface ModpackProgressEvent {
  phase: "downloading_modpack" | "parsing" | "downloading_files" | "copying_overrides" | "done";
  current: number;
  total: number;
  message: string;
}

/** Result of creating an instance from a modpack */
export interface CreateFromModpackResult {
  success: boolean;
  instanceName: string;
  stats: ModpackInstallStats;
}

export interface ModpackInstallStats {
  totalFiles: number;
  downloaded: number;
  skipped: number;
  errors: number;
  overridesCopied: boolean;
}
