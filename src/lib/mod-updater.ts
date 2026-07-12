/**
 * Frontend API dla aktualizacji modów (TASK-21).
 * Sprawdzanie dostępności aktualizacji przez API Modrinth (frontend),
 * pobieranie nowego JARa przez Tauri backend.
 */

import { invoke } from "@tauri-apps/api/core";
import { getProjectVersions } from "@/lib/modrinth";
import type { InstalledMod } from "@/lib/mod-installer";
import type { ModrinthVersion } from "@/types/modrinth";

// ─── Types ──────────────────────────────────────────────────────────

export interface ModUpdate {
  /** The currently installed mod info */
  mod: InstalledMod;
  /** New version details */
  newVersion: ModrinthVersion;
  /** Primary file of the new version (what to download) */
  newFile: ModrinthVersion["files"][number];
  /** The old version ID (for reference) */
  oldVersionId: string;
  /** New version number string */
  newVersionNumber: string;
}

// ─── Check for updates ──────────────────────────────────────────────

/**
 * Check which mods have available updates.
 * Only checks mods that have a projectSlug (installed via the app).
 */
export async function checkModUpdates(
  mods: InstalledMod[],
  mcVersion?: string,
  onProgress?: (checked: number, total: number, currentName: string) => void,
): Promise<ModUpdate[]> {
  // Only process mods that have a projectSlug (installed via the app)
  const checkableMods = mods.filter((m) => m.projectSlug);
  const total = checkableMods.length;
  if (total === 0) return [];

  const updates: ModUpdate[] = [];
  let checked = 0;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = checkableMods.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (mod) => {
        try {
          const slug = mod.projectSlug!;
          const versions = await getProjectVersions(slug, {
            loaders: ["fabric"],
            gameVersions: mcVersion ? [mcVersion] : undefined,
          });

          if (versions.length === 0) return null;

          // Find latest release version
          const latest = versions.find(
            (v) => v.version_type === "release",
          ) ?? versions[0];

          if (!latest) return null;

          // Skip if same version
          if (mod.versionId && latest.id === mod.versionId) return null;

          // Find the primary file
          const primaryFile = latest.files.find((f) => f.primary) ?? latest.files[0];
          if (!primaryFile) return null;

          return {
            mod,
            newVersion: latest,
            newFile: primaryFile,
            oldVersionId: mod.versionId || "",
            newVersionNumber: latest.version_number,
          } satisfies ModUpdate;
        } finally {
          onProgress?.(++checked, total, mod.name);
        }
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        updates.push(result.value);
      }
    }
  }

  return updates;
}

// ─── Update a single mod ────────────────────────────────────────────

/**
 * Update a single mod — download new JAR, remove old, update registry.
 */
export async function updateMod(
  instanceName: string,
  oldFileName: string,
  newFileName: string,
  downloadUrl: string,
  newVersionId: string,
  newVersionNumber: string,
  iconUrl?: string | null,
): Promise<InstalledMod> {
  return invoke<InstalledMod>("update_mod", {
    instanceName,
    oldFileName,
    newFileName,
    downloadUrl,
    newVersionId,
    newVersionNumber,
    iconUrl,
  });
}
