import {
  type CreateInstanceInput,
  CURRENT_SCHEMA_VERSION,
  type InstanceManifest,
  type ManifestError,
  type ReadManifestResult,
} from "@/types/instance";

// ─── Migration registry ────────────────────────────────────────────
// Each migration function transforms a manifest from version N to N+1.
// Key: source version, Value: transform function
const migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  // Example: 1 → 2 migration (placeholder for future use)
  // 1: (data) => ({ ...data, newField: "default", schemaVersion: 2 }),
};

// ─── Validation ─────────────────────────────────────────────────────

/**
 * Check if raw data has a valid schemaVersion field.
 */
export function hasSchemaVersion(data: unknown): data is Record<string, unknown> & { schemaVersion: number } {
  if (typeof data !== "object" || data === null) return false;
  if (!("schemaVersion" in data)) return false;
  const sv = (data as Record<string, unknown>).schemaVersion;
  return typeof sv === "number" && Number.isInteger(sv) && sv >= 1;
}

/**
 * Validate that an object conforms to the InstanceManifest interface.
 */
export function isValidManifest(data: unknown): data is InstanceManifest {
  if (typeof data !== "object" || data === null) return false;
  const m = data as Record<string, unknown>;
  return (
    typeof m.schemaVersion === "number" &&
    typeof m.name === "string" &&
    typeof m.mcVersion === "string" &&
    typeof m.loader === "string" &&
    typeof m.loaderVersion === "string" &&
    typeof m.javaVersion === "string" &&
    typeof m.ram === "number" &&
    typeof m.createdAt === "string" &&
    typeof m.updatedAt === "string"
  );
}

// ─── Migration ──────────────────────────────────────────────────────

/**
 * Migrate a manifest from any older schema version to the current version.
 * Returns the migrated manifest or throws a ManifestError.
 */
export function migrateManifest(data: Record<string, unknown>): ReadManifestResult {
  if (!hasSchemaVersion(data)) {
    throw {
      code: "INVALID_SCHEMA",
      message: "Manifest is missing required 'schemaVersion' field",
    } satisfies ManifestError;
  }

  // data has schemaVersion verified by hasSchemaVersion
  let current = { ...data } as Record<string, unknown> & { schemaVersion: number };
  let migrated = false;

  // Apply migrations sequentially until we reach the current version
  while ((current as Record<string, unknown>).schemaVersion as number < CURRENT_SCHEMA_VERSION) {
    const sourceVersion = current.schemaVersion;
    const migrationFn = migrations[sourceVersion];

    if (!migrationFn) {
      throw {
        code: "MIGRATION_FAILED",
        message: `No migration path from schema version ${sourceVersion} to ${sourceVersion + 1}`,
      } satisfies ManifestError;
    }

    current = migrationFn(current) as Record<string, unknown> & { schemaVersion: number };
    migrated = true;
  }

  if (!isValidManifest(current)) {
    throw {
      code: "PARSE_ERROR",
      message: "Manifest data is invalid after migration",
    } satisfies ManifestError;
  }

  return { manifest: current as InstanceManifest, migrated };
}

// ─── Factory ────────────────────────────────────────────────────────

/**
 * Create a new instance manifest from user input.
 */
export function createManifest(input: CreateInstanceInput): InstanceManifest {
  const now = new Date().toISOString().split("T")[0] ?? new Date().toISOString();

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: input.name,
    mcVersion: input.mcVersion,
    loader: input.loader,
    loaderVersion: input.loaderVersion,
    javaVersion: input.javaVersion,
    ram: input.ram,
    jvmArgs: input.jvmArgs,
    createdAt: now,
    updatedAt: now,
  };
}
