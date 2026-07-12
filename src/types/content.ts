/** Types for content items (resource packs, shaders) managed per-instance */

export interface InstalledContent {
  fileName: string;
  size: number;
  modifiedAt: string;
  /** Display title (from Modrinth project) */
  title?: string | null;
  /** Version ID on Modrinth */
  versionId?: string | null;
  /** Human-readable version number (e.g. "1.0.0") */
  versionNumber?: string | null;
  /** Modrinth project slug */
  projectSlug?: string | null;
  /** URL to project icon */
  iconUrl?: string | null;
}

/** Progress event from modpack installation */
export interface ModpackProgressEvent {
  phase: "downloading_modpack" | "parsing" | "downloading_files" | "resolving_metadata" | "copying_overrides" | "done";
  current: number;
  total: number;
  message: string;
}

/** Event emitted when modpack installation completes successfully */
export interface ModpackDoneEvent {
  instanceName: string;
}

/** Event emitted when modpack installation fails or is cancelled */
export interface ModpackErrorEvent {
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
