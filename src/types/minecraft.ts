/** Minecraft version from the Mojang version manifest */
export interface MinecraftVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<{
    id: string;
    type: "release" | "snapshot" | "old_beta" | "old_alpha";
    url: string;
    time: string;
    releaseTime: string;
  }>;
}

/** A single library entry in the version JSON */
export interface MinecraftLibrary {
  name: string;
  /** Optional custom Maven repository URL (used by Fabric/Forge libraries) */
  url?: string;
  downloads?: {
    artifact?: MinecraftDownloadArtifact;
    classifiers?: Record<string, MinecraftDownloadArtifact>;
  };
  rules?: MinecraftRule[];
  extract?: {
    exclude: string[];
  };
  natives?: Record<string, string>;
}

/** Download artifact for a library or game file */
export interface MinecraftDownloadArtifact {
  path: string;
  url: string;
  sha1: string;
  size: number;
}

/** Rule for conditional libraries (OS-specific, etc.) */
export interface MinecraftRule {
  action: "allow" | "disallow";
  os?: {
    name?: "windows" | "osx" | "linux";
    arch?: string;
    version?: string;
  };
  features?: Record<string, boolean>;
}

/** Asset index reference */
export interface MinecraftAssetIndex {
  id: string;
  sha1: string;
  size: number;
  totalSize: number;
  url: string;
}

/** Logging configuration (new in Minecraft 26.x) */
export interface MinecraftLoggingConfig {
  client: {
    argument: string;
    file: {
      id: string;
      sha1: string;
      size: number;
      url: string;
    };
    type: string;
  };
}

/** Game/downloads section of version JSON */
export interface MinecraftDownloads {
  client: MinecraftDownloadArtifact;
  client_mappings?: MinecraftDownloadArtifact;
  server?: MinecraftDownloadArtifact;
  server_mappings?: MinecraftDownloadArtifact;
}

/** The raw version JSON from Mojang API */
export interface MinecraftVersionJson {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  mainClass: string;
  minecraftArguments?: string;
  arguments?: {
    game: Array<string | MinecraftArgumentRules>;
    jvm: Array<string | MinecraftArgumentRules>;
  };
  libraries: MinecraftLibrary[];
  /** Legacy asset version string (e.g. "32"). Now just a string in 26.x+ */
  assets?: string;
  assetIndex: MinecraftAssetIndex;
  /** Logging config (new in 26.x). Provides log4j2 config file URL and JVM arg template. */
  logging?: MinecraftLoggingConfig;
  downloads: MinecraftDownloads;
  releaseTime: string;
  minimumLauncherVersion?: number;
  javaVersion?: {
    component: string;
    majorVersion: number;
  };
  inheritsFrom?: string;
  complianceLevel?: number;
}

/** Argument with OS rules (for conditional arguments) */
export interface MinecraftArgumentRules {
  rules: MinecraftRule[];
  value: string | string[];
}

/** Resolved library with platform filtering applied */
export interface ResolvedLibrary {
  /** Maven coordinates (e.g. "org.lwjgl:lwjgl:3.3.1") */
  name: string;
  /** Download URL */
  url: string;
  /** Relative path inside libraries dir */
  path: string;
  /** SHA-1 hash for verification */
  sha1: string;
  /** File size in bytes */
  size: number;
  /** Whether this is a native library (needs extraction) */
  isNative: boolean;
}

/** Asset object from asset index */
export interface AssetObject {
  hash: string;
  size: number;
  objects: Record<
    string,
    {
      hash: string;
      size: number;
    }
  >;
}

/** Fabric version metadata for merging with Vanilla */
export interface FabricVersionMeta {
  id: string;
  inheritsFrom: string;
  releaseTime: string;
  time: string;
  type: "release";
  mainClass: string;
  arguments: {
    game: Array<string | MinecraftArgumentRules>;
    jvm: Array<string | MinecraftArgumentRules>;
  };
  libraries: MinecraftLibrary[];
}

/** Logging config resolved for launching (file path + JVM argument) */
export interface ResolvedLoggingConfig {
  /** Path to the downloaded logging config file */
  filePath: string;
  /** Download URL for the logging config file */
  fileUrl: string;
  /** SHA1 hash for verification */
  sha1: string;
  /** JVM argument template (e.g. "-Dlog4j.configurationFile=${path}") */
  argument: string;
}

/** Resolved version ready for launching */
export interface ResolvedVersion {
  /** Full version ID */
  id: string;
  /** Main class to launch */
  mainClass: string;
  /** Minecraft version (e.g. "1.21") */
  mcVersion: string;
  /** Type of version */
  type: string;
  /** Resolved game arguments */
  gameArguments: string[];
  /** Resolved JVM arguments */
  jvmArguments: string[];
  /** List of libraries to download */
  libraries: ResolvedLibrary[];
  /** Minecraft client.jar artifact */
  clientJar: MinecraftDownloadArtifact;
  /** Asset index reference */
  assetIndex: MinecraftAssetIndex;
  /** Logging config (new in 26.x). Undefined if not present. */
  logging?: ResolvedLoggingConfig;
  /** Release time */
  releaseTime: string;
}

/** Options for launching Minecraft */
export interface LaunchOptions {
  /** Java executable path */
  javaPath: string;
  /** Instance directory — Minecraft writes saves, mods, configs, etc. here */
  gameDir: string;
  /** Global base dir for libraries, assets, versions (defaults to gameDir if not set) */
  librariesBase?: string;
  /** Resolved version info */
  version: ResolvedVersion;
  /** Auth player data */
  auth: {
    username: string;
    uuid: string;
    accessToken?: string;
    xuid?: string;
    userType?: "msa" | "mojang" | "legacy";
  };
  /** RAM in MB */
  memory: number;
  /** Custom JVM args */
  jvmArgs?: string;
  /** Window size */
  window?: {
    width: number;
    height: number;
  };
  /** Server to auto-connect */
  server?: {
    ip: string;
    port?: number;
  };
  /** Path to the AnonChat JAR agent */
  anonChatPath?: string;

  /** Whether to detach the Java process */
  detached?: boolean;
}
