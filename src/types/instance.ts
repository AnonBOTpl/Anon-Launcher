/** Current schema version for instance manifests */
export const CURRENT_SCHEMA_VERSION = 1;

/** Supported Minecraft loaders */
export type LoaderType = "vanilla" | "fabric" | "neoforge";

/** Instance manifest - v1 schema */
export interface InstanceManifest {
  /** Schema version for migration support (required) */
  schemaVersion: number;
  /** Display name of the instance */
  name: string;
  /** Minecraft version (e.g. "1.21.8") */
  mcVersion: string;
  /** Mod loader type */
  loader: LoaderType;
  /** Mod loader version (e.g. "0.17.3") */
  loaderVersion: string;
  /** Required Java version (e.g. "21") */
  javaVersion: string;
  /** Custom Java path (optional, user-provided) */
  customJavaPath?: string;
  /** Allocated RAM in MB */
  ram: number;
  /** JVM arguments (optional) */
  jvmArgs?: string;
  /** ISO date of creation */
  createdAt: string;
  /** ISO date of last update */
  updatedAt: string;
}

/** Minimal data required to create a new instance */
export interface CreateInstanceInput {
  name: string;
  mcVersion: string;
  loader: LoaderType;
  loaderVersion: string;
  javaVersion: string;
  customJavaPath?: string;
  ram: number;
  jvmArgs?: string;
}

/** Result of a manifest read operation */
export interface ReadManifestResult {
  manifest: InstanceManifest;
  migrated: boolean;
}

/** Error type for manifest operations */
export interface ManifestError {
  code: "INVALID_SCHEMA" | "PARSE_ERROR" | "NOT_FOUND" | "MIGRATION_FAILED";
  message: string;
}
