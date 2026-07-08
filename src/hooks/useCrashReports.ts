import { useState, useEffect, useCallback, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  listCrashReports,
  readCrashReport,
  deleteCrashReport,
  deleteAllCrashReports,
  type CrashReport,
} from "@/lib/crash-reports";

interface UseCrashReportsReturn {
  /** List of crash reports */
  reports: CrashReport[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Currently selected report for preview (filename) */
  selectedReport: string | null;
  /** Content of the selected report */
  selectedContent: string | null;
  /** Loading content */
  contentLoading: boolean;
  /** Whether a new crash was detected this session */
  hasNewCrash: boolean;
  /** Select a report to view */
  selectReport: (filename: string | null) => void;
  /** Refresh the list of crash reports */
  refresh: () => Promise<void>;
  /** Delete a single report */
  remove: (filename: string) => Promise<void>;
  /** Delete all reports */
  removeAll: () => Promise<void>;
  /** Dismiss the "new crash" notification */
  dismissNewCrash: () => void;
}

/**
 * Hook for managing crash reports of a game instance.
 * Automatically scans for new crash reports when the game process stops.
 * Loads existing reports on mount and auto-detects new crashes.
 */
export function useCrashReports(instanceName?: string): UseCrashReportsReturn {
  const [reports, setReports] = useState<CrashReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [hasNewCrash, setHasNewCrash] = useState(false);
  const refreshAfterStopRef = useRef<(() => Promise<void>) | null>(null);

  // Load existing crash reports on mount / instanceName change
  useEffect(() => {
    if (!instanceName) {
      setReports([]);
      setSelectedReport(null);
      setSelectedContent(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await listCrashReports(instanceName!);
        if (!cancelled) {
          setReports(result);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load crash reports";
          setError(message);
          setReports([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [instanceName]);

  // Store refreshAfterStop in a ref so the event listener can always access
  // the latest version without re-registering.
  const refreshAfterStop = useCallback(async () => {
    if (!instanceName) return;

    try {
      const result = await listCrashReports(instanceName);
      setReports(result);

      if (result.length > 0) {
        setHasNewCrash(true);
        // Store the first report filename for auto-selection
        const firstFilename = result[0]?.filename;
        if (firstFilename) {
          setSelectedReport(firstFilename);
          // Load content
          const content = await readCrashReport(instanceName, firstFilename);
          setSelectedContent(content);
        }
      }
    } catch {
      // Silently fail — no crash reports to show
    }
  }, [instanceName]);

  // Keep ref updated
  useEffect(() => {
    refreshAfterStopRef.current = refreshAfterStop;
  }, [refreshAfterStop]);

  // Listen for instance:stopped event to auto-scan for crash reports
  useEffect(() => {
    if (!instanceName) return;

    let unlisten: UnlistenFn | undefined;

    async function setup() {
      unlisten = await listen<{
        instanceName: string;
        pid?: number;
        exitCode?: number | null;
      }>("instance:stopped", (event) => {
        if (event.payload.instanceName === instanceName) {
          // Non-zero exit code likely means a crash
          if (
            event.payload.exitCode !== 0 &&
            event.payload.exitCode !== null &&
            event.payload.exitCode !== undefined
          ) {
            // Call refreshAfterStop directly (don't use ref — it's async)
            refreshAfterStopRef.current?.();
          }
        }
      });
    }

    setup();

    return () => {
      unlisten?.();
    };
  }, [instanceName]);

  // Refresh the list (manual refresh button)
  const refresh = useCallback(async () => {
    if (!instanceName) {
      setReports([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await listCrashReports(instanceName);
      setReports(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load crash reports";
      setError(message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [instanceName]);

  // Load content when a report is selected
  const selectReport = useCallback(
    async (filename: string | null) => {
      setSelectedReport(filename);

      if (!filename || !instanceName) {
        setSelectedContent(null);
        return;
      }

      setContentLoading(true);
      try {
        const content = await readCrashReport(instanceName, filename);
        setSelectedContent(content);
      } catch {
        setSelectedContent("// Failed to load crash report content");
      } finally {
        setContentLoading(false);
      }
    },
    [instanceName],
  );

  // Delete a single report
  const remove = useCallback(
    async (filename: string) => {
      if (!instanceName) return;

      try {
        await deleteCrashReport(instanceName, filename);
        // If we deleted the selected report, clear selection
        if (selectedReport === filename) {
          setSelectedReport(null);
          setSelectedContent(null);
        }
        // Refresh the list
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete crash report";
        setError(message);
      }
    },
    [instanceName, selectedReport, refresh],
  );

  // Delete all reports
  const removeAll = useCallback(async () => {
    if (!instanceName) return;

    try {
      await deleteAllCrashReports(instanceName);
      setSelectedReport(null);
      setSelectedContent(null);
      setReports([]);
      setHasNewCrash(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete crash reports";
      setError(message);
    }
  }, [instanceName]);

  // Dismiss new crash notification
  const dismissNewCrash = useCallback(() => {
    setHasNewCrash(false);
  }, []);

  return {
    reports,
    loading,
    error,
    selectedReport,
    selectedContent,
    contentLoading,
    hasNewCrash,
    selectReport,
    refresh,
    remove,
    removeAll,
    dismissNewCrash,
  };
}
