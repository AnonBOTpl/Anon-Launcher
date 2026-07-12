/**
 * Frontend dependency resolver for mods (TASK-22).
 * Uses Modrinth API to fetch dependency chains and Rust backend to check
 * which deps are already installed.
 */

import { invoke } from "@tauri-apps/api/core";
import { getProjectVersions } from "@/lib/modrinth";
import type { ModrinthVersion } from "@/types/modrinth";

// ─── Simple check (used by install flow) ───────────────────────────

/**
 * Simple check: given a dependencies array from a Modrinth version,
 * check which are installed via the Rust backend.
 * Returns the same structure as the recursive resolve but without transitive resolution.
 */
export async function checkModDependencies(
  instanceName: string,
  dependencies: ModrinthVersion["dependencies"],
): Promise<ResolveResult> {
  const relevantDeps = dependencies.filter(
    (d) => d.project_id && d.dependency_type !== "embedded",
  );

  if (relevantDeps.length === 0) {
    return { dependencies: [], circularDetected: false, hasMissing: false, hasConflicts: false };
  }

  // Resolve project names AND slugs (slugs needed for Rust matching)
  const projectIds = [...new Set(relevantDeps.map((d) => d.project_id as string))];
  const metaResults = await Promise.all(projectIds.map((id) => resolveProjectMeta(id)));

  // Maps keyed by hash project_id
  const slugMap = new Map<string, string | null>();
  const metaMap = new Map<string, { name: string; iconUrl: string | null }>();
  for (let i = 0; i < projectIds.length; i++) {
    const r = metaResults[i];
    if (r) {
      slugMap.set(projectIds[i]!, r.slug);
      metaMap.set(projectIds[i]!, { name: r.name, iconUrl: r.iconUrl });
    }
  }

  // Send SLUGS to Rust (Rust matches against registry's project_slug)
  const statusMap = await checkInstalledStatus(
    instanceName,
    relevantDeps.map((d) => {
      const hash = d.project_id!;
      const slug = slugMap.get(hash);
      return { projectId: slug ?? hash, type: d.dependency_type };
    }),
  );

  // Build deps — look up status by slug, but keep project_id (hash) for identity
  const deps: DependencyInfo[] = relevantDeps.map((dep) => {
    const pid = dep.project_id!;
    const slug = slugMap.get(pid);
    // Try to look up by slug first, then by hash (fallback)
    const status = statusMap.get(slug ?? pid) ?? statusMap.get(pid);
    const meta = metaMap.get(pid);
    return {
      projectId: pid,
      type: dep.dependency_type as DependencyInfo["type"],
      installed: status?.installed ?? false,
      installedName: status?.installedName,
      modName: meta?.name ?? pid,
      iconUrl: meta?.iconUrl ?? null,
      depth: 0,
    };
  });

  const hasMissing = deps.some((d) => d.type === "required" && !d.installed);
  const hasConflicts = deps.some((d) => d.type === "incompatible" && d.installed);

  return { dependencies: deps, circularDetected: false, hasMissing, hasConflicts };
}

// ─── Types ──────────────────────────────────────────────────────────

export interface DependencyInfo {
  /** Modrinth project ID */
  projectId: string;
  /** Dependency type */
  type: "required" | "optional" | "incompatible" | "embedded";
  /** Whether already installed in instance */
  installed: boolean;
  /** Installed mod name if installed */
  installedName?: string;
  /** Resolved mod name (from API) */
  modName?: string;
  /** Resolved mod icon URL */
  iconUrl?: string | null;
  /** Child dependencies (transitive) */
  children?: DependencyInfo[];
  /** Depth level for UI indentation */
  depth: number;
}

export interface ResolveResult {
  dependencies: DependencyInfo[];
  circularDetected: boolean;
  hasMissing: boolean;
  hasConflicts: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Match a project slug to installed mods by comparing against installed projectSlugs. */
async function checkInstalledStatus(
  instanceName: string,
  deps: Array<{ projectId: string; type: string }>,
): Promise<Map<string, { installed: boolean; installedName?: string }>> {
  try {
    const result = await invoke<{
      dependencies: Array<{
        projectId: string;
        dependencyType: string;
        installed: boolean;
        installedName?: string | null;
      }>;
    }>("resolve_mod_dependencies", {
      instanceName,
      dependencies: deps.map((d) => ({
        projectId: d.projectId,
        dependencyType: d.type,
      })),
    });

    const map = new Map<string, { installed: boolean; installedName?: string }>();
    for (const dep of result.dependencies) {
      map.set(dep.projectId, {
        installed: dep.installed,
        installedName: dep.installedName ?? undefined,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Resolve a single project to get its metadata (name, icon, slug).
 *  Slug is critical: Rust backend matches installed mods by project_slug,
 *  but Modrinth dependency API returns project_id (hash). We resolve it here. */
async function resolveProjectMeta(
  projectId: string,
): Promise<{ name: string; iconUrl: string | null; slug: string | null } | null> {
  try {
    const response = await fetch(
      `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return {
      name: data.title || projectId,
      iconUrl: data.icon_url || null,
      slug: data.slug || null,
    };
  } catch {
    return { name: projectId, iconUrl: null, slug: null };
  }
}

// ─── Main resolver ──────────────────────────────────────────────────

/**
 * Recursively resolve dependencies for a given version.
 * @param instanceName - Instance to check against installed mods
 * @param version - The ModrinthVersion to resolve deps for
 * @param visited - Set of already-visited project IDs (cycle detection)
 * @param depth - Current recursion depth
 */
export async function resolveDependencies(
  instanceName: string,
  version: ModrinthVersion,
  visited: Set<string> = new Set(),
  depth: number = 0,
): Promise<ResolveResult> {
  const allDeps: DependencyInfo[] = [];
  let circularDetected = false;

  // Filter to only relevant deps (skip embedded)
  const relevantDeps = version.dependencies.filter(
    (d) => d.project_id && d.dependency_type !== "embedded",
  );

  if (relevantDeps.length === 0) {
    return { dependencies: [], circularDetected: false, hasMissing: false, hasConflicts: false };
  }

  // Resolve project names AND slugs (slugs needed for Rust matching)
  const projectIds = [...new Set(relevantDeps.map((d) => d.project_id as string))];
  const metaResults = await Promise.all(projectIds.map((id) => resolveProjectMeta(id)));

  const slugMap = new Map<string, string | null>();
  const metaMap = new Map<string, { name: string; iconUrl: string | null }>();
  for (let i = 0; i < projectIds.length; i++) {
    const r = metaResults[i];
    if (r) {
      slugMap.set(projectIds[i]!, r.slug);
      metaMap.set(projectIds[i]!, { name: r.name, iconUrl: r.iconUrl });
    }
  }

  // Check installed — send SLUGS to Rust (matches against project_slug in registry)
  const statusMap = await checkInstalledStatus(
    instanceName,
    relevantDeps.map((d) => {
      const hash = d.project_id!;
      const slug = slugMap.get(hash);
      return { projectId: slug ?? hash, type: d.dependency_type };
    }),
  );

  // Process each dependency
  for (const dep of relevantDeps) {
    const pid = dep.project_id!;
    const slug = slugMap.get(pid);
    const status = statusMap.get(slug ?? pid) ?? statusMap.get(pid);
    const meta = metaMap.get(pid);

    // Cycle detection
    if (visited.has(pid)) {
      circularDetected = true;
      allDeps.push({
        projectId: pid,
        type: dep.dependency_type as DependencyInfo["type"],
        installed: status?.installed ?? false,
        installedName: status?.installedName,
        modName: meta?.name ?? pid,
        iconUrl: meta?.iconUrl ?? null,
        depth,
        children: [],
      });
      continue;
    }

    visited.add(pid);

    const info: DependencyInfo = {
      projectId: pid,
      type: dep.dependency_type as DependencyInfo["type"],
      installed: status?.installed ?? false,
      installedName: status?.installedName,
      modName: meta?.name ?? pid,
      iconUrl: meta?.iconUrl ?? null,
      depth,
    };

    // If the dep is required and not installed, recursively resolve its transitive deps
    if (dep.dependency_type === "required" && !status?.installed && depth < 3) {
      try {
        const versions = await getProjectVersions(pid, { loaders: ["fabric"] });
        if (versions.length > 0) {
          const latest = versions.find((v) => v.version_type === "release") ?? versions[0]!;
          const transitive = await resolveDependencies(instanceName, latest, visited, depth + 1);
          info.children = transitive.dependencies;
          if (transitive.circularDetected) circularDetected = true;
        }
      } catch {
        // Skip transitive resolution on error
      }
    }

    allDeps.push(info);
  }

  const hasMissing = allDeps.some(
    (d) => d.type === "required" && !d.installed,
  );
  const hasConflicts = allDeps.some(
    (d) => d.type === "incompatible" && d.installed,
  );

  return {
    dependencies: allDeps,
    circularDetected,
    hasMissing,
    hasConflicts,
  };
}
