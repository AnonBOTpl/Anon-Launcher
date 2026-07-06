import { useState, useEffect, useCallback } from "react";
import type { JavaVersionInfo, DownloadStatus } from "@/lib/java";
import { fetchJavaVersions, downloadJava, getJavaPath } from "@/lib/java";
import { getJavaVersionForMc } from "@/lib/java";

interface JavaState {
  versions: JavaVersionInfo[];
  loading: boolean;
  error: string | null;
  downloading: string | null; // version being downloaded, or null
  downloadStatus: DownloadStatus | null;
}

export function useJavaRuntime() {
  const [state, setState] = useState<JavaState>({
    versions: [],
    loading: true,
    error: null,
    downloading: null,
    downloadStatus: null,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const versions = await fetchJavaVersions();
      setState((prev) => ({ ...prev, versions, loading: false }));
    } catch (err) {
      const message =
        typeof err === "string"
          ? err
          : err instanceof Error
            ? err.message
            : "Failed to fetch Java versions";
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startDownload = useCallback(
    async (version: string) => {
      setState((prev) => ({
        ...prev,
        downloading: version,
        downloadStatus: null,
      }));
      try {
        const status = await downloadJava(version);
        setState((prev) => ({
          ...prev,
          downloading: null,
          downloadStatus: status,
        }));
        // Refresh to update installed status
        await refresh();
      } catch (err) {
        const message =
          typeof err === "string"
            ? err
            : err instanceof Error
              ? err.message
              : "Download failed";
        console.error("Java download error:", err);
        setState((prev) => ({
          ...prev,
          downloading: null,
          downloadStatus: {
            version,
            success: false,
            path: null,
            error: message,
          },
        }));
      }
    },
    [refresh],
  );

  /**
   * Check if the required Java for a given Minecraft version is installed.
   * Returns the required version if not installed, or null if OK.
   */
  const checkJavaForMc = useCallback(
    (mcVersion: string): { required: string; installed: boolean } => {
      const required = getJavaVersionForMc(mcVersion);
      const installed = state.versions.some(
        (v) => v.version === required && v.installed && v.verified,
      );
      return { required, installed };
    },
    [state.versions],
  );

  const getJavaPathForVersion = useCallback(
    async (version: string): Promise<string | null> => {
      try {
        return await getJavaPath(version);
      } catch {
        return null;
      }
    },
    [],
  );

  return {
    ...state,
    refresh,
    startDownload,
    checkJavaForMc,
    getJavaPathForVersion,
  };
}
