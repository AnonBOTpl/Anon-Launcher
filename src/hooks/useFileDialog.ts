import { useCallback } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";

interface SaveFileOptions {
  /** Default file name */
  defaultName?: string;
  /** File filter name (e.g. "ZIP Archive") */
  filterName?: string;
  /** File extensions (e.g. ["zip"]) */
  extensions?: string[];
}

interface OpenFileOptions {
  /** File filter name */
  filterName?: string;
  /** File extensions */
  extensions?: string[];
  /** Allow multiple files */
  multiple?: boolean;
}

/**
 * Hook providing functions to open native save/open file dialogs via Tauri.
 */
export function useFileDialog() {
  const showSaveDialog = useCallback(
    async (options?: SaveFileOptions): Promise<string | null> => {
      try {
        const path = await save({
          defaultPath: options?.defaultName,
          filters: options?.extensions
            ? [
                {
                  name: options?.filterName ?? "Plik",
                  extensions: options.extensions,
                },
              ]
            : undefined,
        });
        return path;
      } catch {
        return null;
      }
    },
    [],
  );

  const showOpenDialog = useCallback(
    async (options?: OpenFileOptions): Promise<string | null> => {
      try {
        const result = await open({
          multiple: options?.multiple ?? false,
          directory: false,
          filters: options?.extensions
            ? [
                {
                  name: options?.filterName ?? "Plik",
                  extensions: options.extensions,
                },
              ]
            : undefined,
        });
        // open() returns string | string[] | null
        if (result === null) return null;
        if (Array.isArray(result)) return result[0] ?? null;
        return result;
      } catch {
        return null;
      }
    },
    [],
  );

  return { showSaveDialog, showOpenDialog };
}
