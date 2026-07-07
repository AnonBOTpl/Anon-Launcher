import type { ResolvedVersion, LaunchOptions } from "@/types/minecraft";

// ─── Path Resolution ──────────────────────────────────────────────────

/**
 * Get the base directory for Minecraft files.
 * All paths are relative to the instance directory (gameDir).
 */
function getMinecraftDirs(gameDir: string) {
  return {
    /** Libraries directory */
    libraries: `${gameDir}/libraries`,
    /** Versions directory (for client jar) */
    versions: `${gameDir}/versions`,
    /** Assets directory */
    assets: `${gameDir}/assets`,
    /** Natives directory (extracted native libraries) */
    natives: `${gameDir}/natives`,
  };
}

// ─── Classpath Generation ─────────────────────────────────────────────

/**
 * Generate the classpath string (list of JARs separated by platform separator).
 * Includes all non-native libraries and the client jar.
 */
export function generateClasspath(
  resolved: ResolvedVersion,
  gameDir: string,
): string {
  const dirs = getMinecraftDirs(gameDir);
  const separator = detectPathSeparator();

  const paths: string[] = [];

  // Add all non-native libraries
  for (const lib of resolved.libraries) {
    if (!lib.isNative) {
      paths.push(`${dirs.libraries}/${lib.path}`);
    }
  }

  // Add the client jar
  paths.push(`${dirs.versions}/${resolved.id}/${resolved.id}.jar`);

  return paths.join(separator);
}

// ─── Launch Arguments Generation ──────────────────────────────────────

/**
 * Replace template variables in Minecraft arguments.
 * Minecraft uses ${variable_name} syntax.
 */
function replaceTokens(template: string, tokens: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(tokens)) {
    // Split by "${key}" (e.g. "${auth_player_name}") and join with value
    // Using split/join is simpler and more reliable than regex for this use case.
    // String concatenation avoids any template literal escaping ambiguity.
    result = result.split("${" + key + "}").join(value);
  }
  return result;
}

/**
 * Generate the full array of launch arguments (JVM args + Minecraft args).
 * Returns arguments ready to pass to Java process.
 * 
 * Paths:
 * - gameDir = per-instance directory (saves, mods, configs, resourcepacks)
 * - librariesBase = global directory (libraries, assets, versions, natives)
 *   Defaults to gameDir if not set.
 */
export function generateLaunchArgs(
  options: LaunchOptions,
): string[] {
  const { gameDir, version, auth, memory, jvmArgs, window, server } =
    options;

  // Separate per-instance data dir from global library dir
  const librariesBase = options.librariesBase || gameDir;
  const dirs = getMinecraftDirs(librariesBase);
  const separator = detectPathSeparator();
  const classpath = generateClasspath(version, librariesBase);

  // ── Token map for argument substitution ──────────────────────────────
  const tokens: Record<string, string> = {
    // Auth
    auth_player_name: auth.username,
    // Format UUID with dashes: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    auth_uuid: auth.uuid.length === 32
      ? `${auth.uuid.slice(0, 8)}-${auth.uuid.slice(8, 12)}-${auth.uuid.slice(12, 16)}-${auth.uuid.slice(16, 20)}-${auth.uuid.slice(20)}`
      : auth.uuid,
    auth_access_token: auth.accessToken || "",
    auth_xuid: auth.xuid || "",
    user_type: auth.userType || "msa",
    user_properties: "{}",

    // Version
    version_name: version.id,
    version_type: version.type,

    // Directories — game_directory points to PER-INSTANCE dir (saves, mods, etc.)
    game_directory: gameDir,
    assets_root: dirs.assets,

    // Assets
    assets_index_name: version.assetIndex.id,

    // Libraries
    library_directory: dirs.libraries,
    classpath_separator: separator,

    // Natives
    natives_directory: dirs.natives,

    // Window resolution (modern Minecraft uses these in game arguments)
    resolution_width: window ? String(window.width) : "",
    resolution_height: window ? String(window.height) : "",

    // Quick play — use gameDir (instance-specific)
    quickPlayPath: `${gameDir}/quickPlay`,
    quickPlayFilePath: `${gameDir}/quickPlay`,
    quickPlaySingleplayer: "",
    quickPlayMultiplayer: "",
    quickPlayRealms: "",

    // Client ID — musi być zgodny z zarejestrowanym Azure App ID
    clientid: "316a868f-d3ad-4d0f-be3f-4692d5975c34",

    // Launcher info — wymagane przez nowsze wersje Minecraft w JVM args
    // Bez tego ${launcher_name} i ${launcher_version} zostają jako literalne stringi
    launcher_name: "AnonLauncher",
    launcher_version: "1.0.0",
  };

  // ── Build JVM arguments ──────────────────────────────────────────────

  const finalJvmArgs: string[] = [];

  // Base JVM args from version
  for (const arg of version.jvmArguments) {
    finalJvmArgs.push(replaceTokens(arg, tokens));
  }

  // Memory
  finalJvmArgs.push(`-Xms${Math.min(memory, 2048)}M`);
  finalJvmArgs.push(`-Xmx${memory}M`);

  // Game directory (needed before main class)
  finalJvmArgs.push(`-Dminecraft.client.jar=${dirs.versions}/${version.id}/${version.id}.jar`);
  finalJvmArgs.push(`-Dminecraft.launcher.version=anon-1.0`);

  // Always set java.library.path for native libraries (LWJGL2/older versions)
  // Minecraft 1.12.2 and earlier don't include this in their JVM args
  finalJvmArgs.push(`-Djava.library.path=${dirs.natives}`);

  // Logging config JVM arg (Minecraft 26.x+) — TYMCZASOWO WYŁĄCZONE
  // Plik konfiguracyjny log4j2 nie jest pobierany, więc argument wskazuje na nieistniejący plik.
  // Powoduje to przekierowanie logów do pliku zamiast stdout → brak logów w konsoli.
  // TODO: Pobrać plik logging configu i dopiero wtedy dodać ten argument.
  // if (version.logging) {
  //   const loggingPath = `${dirs.assets}/log_configs/${version.logging.filePath}`;
  //   const loggingArg = version.logging.argument.split("${" + "path}").join(loggingPath);
  //   finalJvmArgs.push(loggingArg);
  // }

  // Custom JVM args
  if (jvmArgs) {
    const custom = jvmArgs
      .split(/\s+/)
      .filter((a) => a.trim().length > 0);
    finalJvmArgs.push(...custom);
  }

  // ── Build game arguments ─────────────────────────────────────────────

  const finalGameArgs: string[] = [];

  // Game arguments from version JSON
  for (const arg of version.gameArguments) {
    if (arg.includes("${")) {
      finalGameArgs.push(replaceTokens(arg, tokens));
    } else {
      finalGameArgs.push(arg);
    }
  }

  // Window size
  if (window) {
    finalGameArgs.push("--width", String(window.width));
    finalGameArgs.push("--height", String(window.height));
  }

  // Auto-connect to server
  if (server) {
    finalGameArgs.push(
      "--server",
      server.ip,
      "--port",
      String(server.port || 25565),
    );
  }

  // ── Assemble full command ────────────────────────────────────────────

  // JVM args + -cp + classpath + mainClass + game args
  const fullArgs: string[] = [
    ...finalJvmArgs,
    "-cp",
    classpath,
    version.mainClass,
    ...finalGameArgs,
  ];

  return fullArgs;
}

// ─── Utility ──────────────────────────────────────────────────────────

/**
 * Detect the path separator for the current OS.
 */
function detectPathSeparator(): string {
  // Minecraft classpath always uses : on macOS/Linux and ; on Windows
  if (navigator.platform.includes("Win")) return ";";
  return ":";
}

/**
 * Get paths for native library extraction.
 */
export function getNativesDir(gameDir: string, versionId: string): string {
  return `${gameDir}/natives/${versionId}`;
}

/**
 * Check if a library is a native library that needs extraction.
 */
export function isNativeLibrary(lib: { isNative: boolean }): boolean {
  return lib.isNative;
}
