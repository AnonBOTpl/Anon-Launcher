import type {
  MinecraftVersionManifest,
  MinecraftVersionJson,
  MinecraftLibrary,
  MinecraftRule,
  ResolvedLibrary,
  ResolvedVersion,
  MinecraftArgumentRules,
  FabricVersionMeta,
} from "@/types/minecraft";

const VERSION_MANIFEST_URL =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const FABRIC_META_BASE = "https://meta.fabricmc.net/v2";
const LIBRARIES_BASE = "https://libraries.minecraft.net";

// ─── OS Detection ────────────────────────────────────────────────────

function detectOS(): "windows" | "osx" | "linux" {
  if (navigator.platform.includes("Win")) return "windows";
  if (navigator.platform.includes("Mac")) return "osx";
  return "linux";
}

function detectArch(): string {
  return navigator.platform.includes("64") ? "x64" : "x86";
}

// ─── Rule Evaluation ─────────────────────────────────────────────────

/**
 * Evaluate a list of rules against the current platform.
 * Returns true if the library/argument should be included.
 * Rules are evaluated in order — last matching rule wins.
 * If no rules, the item is allowed by default.
 */
function evaluateRules(rules?: MinecraftRule[]): boolean {
  // No rules → always allowed (platform-independent)
  if (!rules || rules.length === 0) return true;

  // Rules exist → default is DISALLOWED.
  // Each matching rule overrides. Last matching rule wins.
  // Examples:
  //   [{action: "allow", os: {name: "osx"}}] on Windows → no match → false (excluded) ✓
  //   [{action: "allow", os: {name: "osx"}}] on macOS → matches → true (included) ✓
  //   [{action: "allow", os: {name: "windows"}}, {action: "allow", os: {name: "linux"}}] on macOS → no matches → false ✓
  //   [{action: "allow"}] (no OS) → always matches → true ✓
  let allowed = false;
  const os = detectOS();
  const arch = detectArch();

  for (const rule of rules) {
    let matches = true;

    if (rule.os) {
      // Check OS name
      if (rule.os.name && rule.os.name !== os) matches = false;
      // Check architecture
      if (rule.os.arch && rule.os.arch !== arch) matches = false;
    }

    if (matches) {
      allowed = rule.action === "allow";
    }
  }

  return allowed;
}

// ─── Library Path Resolution ──────────────────────────────────────────

/**
 * Convert a Maven coordinate string to a filesystem path.
 * e.g. "org.lwjgl:lwjgl:3.3.1" → "org/lwjgl/lwjgl/3.3.1/lwjgl-3.3.1.jar"
 */
function mavenToPath(name: string, classifier?: string): string {
  const parts = name.split(":");
  const group = parts[0]!.replace(/\./g, "/");
  const artifact = parts[1]!;
  const version = parts[2]!;

  let filename = `${artifact}-${version}`;
  if (classifier) filename += `-${classifier}`;
  filename += ".jar";

  return `${group}/${artifact}/${version}/${filename}`;
}

/**
 * Get the deduplication key for a library (groupId:artifactId[:classifier]).
 * This keeps classifier-based variants separate while deduplicating version conflicts.
 * e.g. "com.mojang:jtracy:1.0.29" → "com.mojang:jtracy"
 * e.g. "com.mojang:jtracy:1.0.29:natives-windows" → "com.mojang:jtracy:natives-windows"
 * e.g. "org.ow2.asm:asm:9.6" and "org.ow2.asm:asm:9.10.1" → "org.ow2.asm:asm" (same → dedup)
 */
function getDedupKey(name: string): string {
  const parts = name.split(":");
  if (parts.length >= 4) {
    return `${parts[0]}:${parts[1]}:${parts[3]}`;
  }
  return `${parts[0]}:${parts[1]}`;
}

/**
 * Resolve a single library entry into a downloadable artifact.
 * Returns null if the library is not applicable to this platform.
 */
function resolveLibrary(lib: MinecraftLibrary): ResolvedLibrary | null {
  // Apply rules
  if (!evaluateRules(lib.rules)) return null;

  // Check for native libraries (old format: natives field with OS-specific classifiers)
  if (lib.natives) {
    const os = detectOS();
    const nativeKey = lib.natives[os === "osx" ? "osx" : os];
    if (!nativeKey) return null;

    const classifier = nativeKey.replace("${arch}", detectArch() === "x64" ? "64" : "86");
    const download = lib.downloads?.classifiers?.[classifier];

    if (download) {
      return {
        name: lib.name,
        url: download.url,
        path: mavenToPath(lib.name, classifier),
        sha1: download.sha1,
        size: download.size,
        isNative: true,
      };
    }

    // Fallback: generate path from maven coords + classifier
    const baseUrl = lib.url ? lib.url.replace(/\/+$/, "") : LIBRARIES_BASE;
    return {
      name: lib.name,
      url: `${baseUrl}/${mavenToPath(lib.name, classifier)}`,
      path: mavenToPath(lib.name, classifier),
      sha1: "",
      size: 0,
      isNative: true,
    };
  }

  // Regular library (or classifier-based variant, e.g. "...:natives-windows")
  // IMPORTANT: Classifier-based native JARs (e.g. lwjgl:3.3.3:natives-windows)
  // are NOT marked as isNative. LWJGL's SharedLibraryLoader loads DLLs directly
  // from classpath JARs. Keeping them on the classpath is required for LWJGL
  // to function. The dedup key (getDedupKey) separates them from main JARs
  // by classifier, so jtracy vs jtracy:natives-windows are both on classpath
  // without conflicting.
  if (lib.downloads?.artifact) {
    const artifact = lib.downloads.artifact;
    return {
      name: lib.name,
      url: artifact.url,
      path: artifact.path,
      sha1: artifact.sha1,
      size: artifact.size,
      isNative: false,
    };
  }

  // Fallback: construct URL from maven coordinates
  // Use library's own repository URL if provided (e.g. Fabric's maven.fabricmc.net)
  const path = mavenToPath(lib.name);
  const baseUrl = lib.url ? lib.url.replace(/\/+$/, "") : LIBRARIES_BASE;
  return {
    name: lib.name,
    url: `${baseUrl}/${path}`,
    path,
    sha1: "",
    size: 0,
    isNative: false,
  };
}

// ─── Argument Resolution ──────────────────────────────────────────────

/**
 * Resolve a version argument entry (could be a string or a rules-wrapped value).
 */
function resolveArgument(
  arg: string | MinecraftArgumentRules,
  features?: Record<string, boolean>,
): string | null {
  if (typeof arg === "string") return arg;

  // Apply rules
  if (!evaluateRules(arg.rules)) return null;

  // Check features
  if (arg.rules) {
    for (const rule of arg.rules) {
      if (rule.features && features) {
        for (const [feature, enabled] of Object.entries(rule.features)) {
          if (features[feature] !== enabled) return null;
        }
      }
    }
  }

  if (typeof arg.value === "string") return arg.value;
  return arg.value.join(" ");
}

// ─── Version Resolution ───────────────────────────────────────────────

/**
 * Fetch the Minecraft version manifest (list of all versions).
 */
export async function fetchVersionManifest(): Promise<MinecraftVersionManifest> {
  const response = await fetch(VERSION_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch version manifest: ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Fetch a specific version JSON from its URL.
 */
export async function fetchVersionJson(url: string): Promise<MinecraftVersionJson> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch version JSON: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch Fabric version metadata for a specific MC version + loader version.
 */
export async function fetchFabricMeta(
  mcVersion: string,
  loaderVersion: string,
): Promise<FabricVersionMeta> {
  const url = `${FABRIC_META_BASE}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Fabric profile for ${mcVersion} ${loaderVersion}: ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Get the version JSON URL for a specific Minecraft version ID.
 */
export async function getVersionUrl(mcVersion: string): Promise<string> {
  const manifest = await fetchVersionManifest();
  const entry = manifest.versions.find((v) => v.id === mcVersion);
  if (!entry) {
    throw new Error(`Minecraft version "${mcVersion}" not found`);
  }
  return entry.url;
}

/**
 * Resolve a complete Minecraft version with all libraries, assets, and arguments.
 * Supports Vanilla and Fabric.
 */
export async function resolveVersion(
  mcVersion: string,
  loader?: { type: "fabric"; version: string },
): Promise<ResolvedVersion> {
  // Get the version JSON URL
  const versionUrl = await getVersionUrl(mcVersion);
  const versionJson = await fetchVersionJson(versionUrl);

  let mainClass = versionJson.mainClass;
  let libraries = [...(versionJson.libraries || [])];
  let gameArgs: Array<string | MinecraftArgumentRules> = [];
  let jvmArgs: Array<string | MinecraftArgumentRules> = [];
  let assetIndex = versionJson.assetIndex;
  let clientJar = versionJson.downloads?.client;

  // Parse arguments
  if (versionJson.arguments) {
    gameArgs = versionJson.arguments.game || [];
    jvmArgs = versionJson.arguments.jvm || [];
  }

  // ── Fabric: merge Fabric metadata ──────────────────────────────────
  if (loader?.type === "fabric" && loader.version) {
    const fabricMeta = await fetchFabricMeta(mcVersion, loader.version);

    // Fabric overrides main class
    mainClass = fabricMeta.mainClass;

    // Add Fabric libraries
    libraries = [...libraries, ...fabricMeta.libraries];

    // Merge Fabric arguments
    if (fabricMeta.arguments) {
      gameArgs = [
        ...(Array.isArray(gameArgs) ? gameArgs : []),
        ...(fabricMeta.arguments.game || []),
      ];
      jvmArgs = [
        ...(Array.isArray(jvmArgs) ? jvmArgs : []),
        ...(fabricMeta.arguments.jvm || []),
      ];
    }
  }

  // ── Resolve libraries ──────────────────────────────────────────────
  const resolvedLibraries: ResolvedLibrary[] = [];
  for (const lib of libraries) {
    const resolved = resolveLibrary(lib);
    if (resolved) {
      // Dedup by groupId:artifactId[:classifier].
      // This keeps classifier-based variants separate (e.g. jtracy vs jtracy:natives-windows)
      // while deduplicating version conflicts (e.g. asm:9.6 gets replaced by asm:9.10.1).
      const dedupKey = getDedupKey(resolved.name);
      const existingIdx = resolvedLibraries.findIndex(
        (l) => getDedupKey(l.name) === dedupKey
      );
      if (existingIdx >= 0) {
        // Replace with Fabric's version (newer / from loader)
        resolvedLibraries[existingIdx] = resolved;
      } else {
        resolvedLibraries.push(resolved);
      }
    }

    // Special case: library has BOTH artifact (main JAR) and natives.
    // resolveLibrary() returns only the native variant when lib.natives exists,
    // causing the main JAR to be lost from the classpath.
    // We need to add the artifact separately so it stays on the classpath.
    // e.g. com.mojang:text2speech:1.10.3 for Minecraft 1.12.2
    if (lib.natives && lib.downloads?.artifact) {
      const artifact = lib.downloads.artifact;
      const artifactName = `${lib.name}:artifact`;
      // Check by exact artifact name — NOT by dedupKey, which would falsely
      // match the native variant (same base name) and skip adding.
      if (!resolvedLibraries.some((l) => l.name === artifactName)) {
        resolvedLibraries.push({
          name: artifactName,
          url: artifact.url,
          path: artifact.path,
          sha1: artifact.sha1,
          size: artifact.size,
          isNative: false,
        });
      }
    }
  }

  // ── Resolve arguments ──────────────────────────────────────────────
  // Features map — determines which conditional arguments are included.
  // is_demo_user: false — konto ma licencję, nie demo
  // has_custom_resolution: false — nie ustawiamy rozdzielczości przez args (używamy --width/--height)
  // has_quick_plays_support: false — nie używamy quick play
  const features: Record<string, boolean> = {
    is_demo_user: false,
    has_custom_resolution: false,
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false,
  };

  const resolvedGameArgs: string[] = [];
  for (const arg of gameArgs) {
    const resolved = resolveArgument(arg, features);
    if (resolved) resolvedGameArgs.push(resolved);
  }

  // Legacy minecraftArguments (pre-1.13) — split into individual tokens
  // e.g. "--username ${auth_player_name} --version ${version_name}"
  //   → ["--username", "${auth_player_name}", "--version", "${version_name}"]
  // Each token gets resolved individually in generateLaunchArgs later.
  if (versionJson.minecraftArguments && resolvedGameArgs.length === 0) {
    const parts = versionJson.minecraftArguments.trim().split(/\s+/);
    resolvedGameArgs.push(...parts);
  }

  const resolvedJvmArgs: string[] = [];
  for (const arg of jvmArgs) {
    const resolved = resolveArgument(arg);
    if (resolved) resolvedJvmArgs.push(resolved);
  }

  return {
    id: versionJson.id,
    mainClass,
    mcVersion,
    type: versionJson.type,
    gameArguments: resolvedGameArgs,
    jvmArguments: resolvedJvmArgs,
    libraries: resolvedLibraries,
    clientJar: {
      path: `versions/${mcVersion}/${mcVersion}.jar`,
      url: clientJar?.url || "",
      sha1: clientJar?.sha1 || "",
      size: clientJar?.size || 0,
    },
    assetIndex,
    releaseTime: versionJson.releaseTime,
  };
}

/**
 * Get the list of all libraries that need to be downloaded.
 * Separates regular libraries, native libraries, and the client jar.
 */
export function getDownloadList(resolved: ResolvedVersion): {
  libraries: ResolvedLibrary[];
  natives: ResolvedLibrary[];
  clientJar: ResolvedLibrary;
} {
  return {
    libraries: resolved.libraries.filter((l) => !l.isNative),
    natives: resolved.libraries.filter((l) => l.isNative),
    clientJar: {
      name: `${resolved.id}:client`,
      url: resolved.clientJar.url,
      path: resolved.clientJar.path,
      sha1: resolved.clientJar.sha1,
      size: resolved.clientJar.size,
      isNative: false,
    },
  };
}