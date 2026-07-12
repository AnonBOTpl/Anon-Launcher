import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// ─── Types ──────────────────────────────────────────────────────────

/** Java version info from backend */
export interface JavaVersionInfo {
  version: string;
  available: boolean;
  installed: boolean;
  path: string | null;
  verified: boolean;
}

/** Download status from backend */
export interface DownloadStatus {
  version: string;
  success: boolean;
  path: string | null;
  error: string | null;
}

// ─── Minecraft → Java version mapping ──────────────────────────────

export interface JavaRequirement {
  version: string;       // e.g. "21"
  label: string;         // e.g. "Java 21"
  description: string;   // e.g. "wymagany od MC 1.20.5"
}

export const JAVA_REQUIREMENTS: JavaRequirement[] = [
  { version: "25", label: "Java 25", description: "Minecraft 26.x+" },
  { version: "21", label: "Java 21", description: "Minecraft 1.20.5+ / 26.x fallback" },
  { version: "17", label: "Java 17", description: "Minecraft 1.17 – 1.20.4" },
  { version: "16", label: "Java 16", description: "Minecraft 1.17 snapshots" },
  { version: "11", label: "Java 11", description: "Minecraft 1.13 – 1.16" },
  { version: "8", label: "Java 8", description: "Minecraft 1.0 – 1.12.2" },
];

/**
 * Determine required Java version for a given Minecraft version.
 *
 * Minecraft zmienił system wersjonowania z 1.x na x (26.x, 27.x, itd.).
 * Nowe wersje (26.x+) wymagają Javy 25.
 *
 * Rules:
 * - 26.x+ (or 26.0+) → Java 25
 * - 1.20.5+ → Java 21
 * - 1.17 – 1.20.4 → Java 17
 * - 1.13 – 1.16 → Java 11
 * - 1.0 – 1.12.2 → Java 8
 */
export function getJavaVersionForMc(mcVersion: string): string {
  const parts = mcVersion.split(".").map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  // Minecraft zmienił wersjonowanie: z 1.21.x → 26.x (bez "1." prefixu)
  // 26.x+ oznacza całkowicie nową erę wersji Minecrafta
  if (major >= 26) {
    return "25";
  }

  // 1.20.5+ → Java 21
  if ((major === 1 && minor > 20) || (major === 1 && minor === 20 && patch >= 5)) {
    return "21";
  }
  // 1.17 – 1.20.4 → Java 17
  if (major === 1 && minor >= 17) {
    return "17";
  }
  // 1.13 – 1.16 → Java 11
  if (major === 1 && minor >= 13) {
    return "11";
  }
  // 1.0 – 1.12.2 → Java 8
  return "8";
}

/**
 * Get the display label for a Java version.
 */
export function getJavaLabel(version: string): string {
  return JAVA_REQUIREMENTS.find((r) => r.version === version)?.label ?? `Java ${version}`;
}

/**
 * Get the description for a Java version.
 */
export function getJavaDescription(version: string): string {
  return JAVA_REQUIREMENTS.find((r) => r.version === version)?.description ?? "";
}

// ─── API Calls ──────────────────────────────────────────────────────

/** Fetch list of available Java versions from Adoptium API. */
export async function fetchJavaVersions(): Promise<JavaVersionInfo[]> {
  return invoke<JavaVersionInfo[]>("get_java_versions");
}

/** Download and extract a Java runtime (event-based, non-blocking). */
export async function downloadJava(version: string): Promise<DownloadStatus> {
  // Set up event listeners BEFORE calling invoke to avoid race conditions
  return new Promise<DownloadStatus>((resolve, reject) => {
    let unlistenComplete: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    listen<{ version: string; success: boolean; path: string | null; error: string | null }>(
      "java:download-complete",
      (event) => {
        if (event.payload.version === version) {
          unlistenComplete?.();
          unlistenError?.();
          resolve({
            version: event.payload.version,
            success: event.payload.success,
            path: event.payload.path,
            error: event.payload.error,
          });
        }
      },
    ).then((fn) => { unlistenComplete = fn; });

    listen<{ version: string; message: string }>(
      "java:download-error",
      (event) => {
        if (event.payload.version === version) {
          unlistenComplete?.();
          unlistenError?.();
          reject(new Error(event.payload.message));
        }
      },
    ).then((fn) => { unlistenError = fn; });

    // Start download (returns immediately)
    invoke("download_java", { version });
  });
}

/** Get path to a locally installed Java executable. */
export async function getJavaPath(version: string): Promise<string> {
  return invoke<string>("get_java_path", { version });
}

/** Verify a custom Java path and return detected version. */
export async function verifyJavaPath(path: string): Promise<string> {
  return invoke<string>("verify_java_path", { path });
}
