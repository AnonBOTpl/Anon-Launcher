import { useState, useCallback, useEffect, useRef } from "react";
import { checkModUpdates } from "@/lib/mod-updater";
import i18n from "@/lib/i18n";
import type { ModUpdate } from "@/lib/mod-updater";
import type { InstalledMod } from "@/lib/mod-installer";

interface UseModUpdatesOptions {
  /** Array of installed mods */
  mods: InstalledMod[];
  /** Minecraft version for filtering Modrinth versions */
  mcVersion?: string;
  /** Auto-check interval in ms (default: 5 minutes) */
  autoCheckInterval?: number;
  /** Whether to auto-check on mount */
  autoCheck?: boolean;
  /** Increment to force a re-check (e.g. after updating all mods) */
  recheckCounter?: number;
}

export interface CheckProgress {
  checked: number;
  total: number;
  currentName: string;
}

export function useModUpdates({
  mods,
  mcVersion,
  autoCheckInterval = 5 * 60 * 1000,
  autoCheck = true,
  recheckCounter = 0,
}: UseModUpdatesOptions) {
  const [updates, setUpdates] = useState<ModUpdate[]>([]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<CheckProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid closures going stale and to avoid infinite effect loops
  const checkingRef = useRef(false);
  const abortRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialCheckDone = useRef(false);

  // Keep latest mods/mcVersion in refs so checkNow always uses fresh data
  const modsRef = useRef(mods);
  const mcVersionRef = useRef(mcVersion);
  modsRef.current = mods;
  mcVersionRef.current = mcVersion;

  const checkNow = useCallback(async () => {
    // Runtime guard using ref — prevents concurrent checks
    if (checkingRef.current) return;
    checkingRef.current = true;
    abortRef.current = false;

    setChecking(true);
    setProgress(null);
    setError(null);

    try {
      const result = await checkModUpdates(
        modsRef.current,
        mcVersionRef.current,
        (checked, total, currentName) => {
          // Only update progress if not aborted
          if (!abortRef.current) {
            setProgress({ checked, total, currentName });
          }
        },
      );
      if (!abortRef.current) {
        setUpdates(result);
        setProgress(null);
      }
    } catch (err) {
      if (!abortRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : i18n.t("mods.updateCheckFailed"),
        );
      }
    } finally {
      checkingRef.current = false;
      if (!abortRef.current) {
        setChecking(false);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-check on mount + interval
  useEffect(() => {
    if (!autoCheck) return;

    const hasSlug = mods.some((m) => m.projectSlug && m.versionId);
    if (!hasSlug) {
      initialCheckDone.current = true;
      return;
    }

    // Force re-check when recheckCounter changes
    if (recheckCounter > 0) {
      initialCheckDone.current = false;
    }

    if (!initialCheckDone.current) {
      initialCheckDone.current = true;
      checkNow();
    }

    intervalRef.current = setInterval(() => {
      if (!abortRef.current) {
        checkNow();
      }
    }, autoCheckInterval);

    return () => {
      // Only abort in-flight requests when the component actually unmounts
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // Intentionally only re-run when mods count or mcVersion changes (not on checkNow change)
    // Also re-run when recheckCounter changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mods.length, mcVersion, autoCheckInterval, autoCheck, recheckCounter]);

  return {
    updates,
    checking,
    progress,
    error,
    hasUpdates: updates.length > 0,
    checkNow,
  } as const;
}
