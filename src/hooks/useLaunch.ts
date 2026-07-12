import i18n from "@/lib/i18n";
import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Log category for tab filtering */
export type LogCategory = "all" | "fabric" | "engine";

/** Log level for filtering */
export type LogLevel = "all" | "info" | "warn" | "error" | "debug";

/** A single log line from the game process */
export interface LogLine {
  stream: "stdout" | "stderr";
  text: string;
  timestamp: number;
  /** Auto-detected category based on thread prefix */
  category?: LogCategory;
  /** Auto-detected log level */
  level?: LogLevel;
}

/** Status of a running instance */
export type LaunchStatus =
  | { type: "idle" }
  | { type: "launching" }
  | { type: "running"; pid: number }
  | { type: "error"; message: string }
  | { type: "stopped"; exitCode: number | null };

interface UseLaunchReturn {
  /** Current launch status */
  status: LaunchStatus;
  /** Log lines from the game process */
  logs: LogLine[];
  /** Launch the instance */
  launch: (instanceName: string, javaPath: string, args: string[]) => Promise<void>;
  /** Stop the instance */
  stop: (instanceName: string) => Promise<void>;
  /** Clear all logs */
  clearLogs: () => void;
}

// ─── Helper: detect log category & level ────────────────────────────

const FABRIC_PATTERNS = [
  /^\[.*?\]\s+\[main\//,          // [thread] [main/INFO]
  /fabric/i,
  /loader/i,
  /mixin/i,
  /knot/i,
  /spongepowered/i,
  /fabricloader/i,
];

const ENGINE_THREAD_PATTERNS = [
  /^\[.*?\]\s+\[Render thread\//,
  /^\[.*?\]\s+\[Server thread\//,
  /^\[.*?\]\s+\[Sound engine\//,
  /^\[.*?\]\s+\[Datafixer Bootstrap\//,
  /^\[.*?\]\s+\[IO thread\//,
  /^\[.*?\]\s+\[Client thread\//,
];

function detectCategory(text: string): LogCategory {
  if (ENGINE_THREAD_PATTERNS.some((p) => p.test(text))) return "engine";
  if (FABRIC_PATTERNS.some((p) => p.test(text))) return "fabric";
  return "engine";
}

function detectLevel(text: string): LogLevel {
  if (/\[ERROR\]|\[error\]|\[SEVERE\]|\[fatal\]|Caused by:|Exception|at .+\(.+\.java:\d+\)/.test(text)) return "error";
  if (/\[WARN\]|\[warn\]|\[WARNING\]|\[warning\]/.test(text)) return "warn";
  if (/\[DEBUG\]|\[debug\]|\[TRACE\]|\[trace\]/.test(text)) return "debug";
  if (/\[INFO\]|\[info\]/.test(text)) return "info";
  return "info";
}

/**
 * Hook for launching and managing Minecraft instances.
 * Subscribes to Tauri events for log streaming and status updates.
 * Automatically deduplicates consecutive identical lines from stdout/stderr.
 */
export function useLaunch(instanceName?: string): UseLaunchReturn {
  const [status, setStatus] = useState<LaunchStatus>({ type: "idle" });
  const [logs, setLogs] = useState<LogLine[]>([]);

  // On mount, check if the process is still running (e.g. after navigating back)
  useEffect(() => {
    if (!instanceName) return;

    invoke<{ type: string; pid?: number }>("get_instance_status", {
      instanceName,
    })
      .then((result) => {
        if (result.type === "running" && result.pid) {
          setStatus({ type: "running", pid: result.pid });
        }
      })
      .catch(() => {
        // Silently ignore — keep default idle state
      });
  }, [instanceName]);

  const unlisteners = useRef<UnlistenFn[]>([]);
  // Bounded dedup buffer: track last N lines to catch stdout/stderr block duplicates
  // (chain() reads all stdout then all stderr → lines arrive in two separate blocks)
  const recentLinesRef = useRef<Set<string>>(new Set());
  const recentOrderRef = useRef<string[]>([]);
  const MAX_RECENT_LINES = 200;

  // Subscribe to Tauri events
  useEffect(() => {
    const cleanups: UnlistenFn[] = [];

    async function setup() {
      // Listen for log lines
      const unlistenLog = await listen<{
        instanceName: string;
        stream: "stdout" | "stderr";
        text: string;
      }>("instance:log", (event) => {
        if (!instanceName || event.payload.instanceName === instanceName) {
          const text = event.payload.text;

          // Deduplicate: skip if this exact line was seen recently
          // Fabric writes every line to both stdout and stderr.
          // chain() delivers all stdout first, then all stderr as a block,
          // so lastLineRef wouldn't catch it — we need a bounded Set.
          if (recentLinesRef.current.has(text)) {
            return;
          }
          recentLinesRef.current.add(text);
          recentOrderRef.current.push(text);
          if (recentOrderRef.current.length > MAX_RECENT_LINES) {
            const oldest = recentOrderRef.current.shift()!;
            recentLinesRef.current.delete(oldest);
          }

          setLogs((prev) => [
            ...prev,
            {
              stream: event.payload.stream,
              text,
              timestamp: Date.now(),
              category: detectCategory(text),
              level: detectLevel(text),
            },
          ]);
        }
      });
      cleanups.push(unlistenLog);

      // Listen for launched event
      const unlistenLaunched = await listen<{
        instanceName: string;
        pid: number;
      }>("instance:launched", (event) => {
        if (!instanceName || event.payload.instanceName === instanceName) {
          setStatus({ type: "running", pid: event.payload.pid });
        }
      });
      cleanups.push(unlistenLaunched);

      // Listen for stopped event
      const unlistenStopped = await listen<{
        instanceName: string;
        exitCode: number | null;
      }>("instance:stopped", (event) => {
        if (!instanceName || event.payload.instanceName === instanceName) {
          setStatus({
            type: "stopped",
            exitCode: event.payload.exitCode ?? null,
          });
          // Add final log line
          const endText = `\n--- ${i18n.t("console.gameExited", { code: event.payload.exitCode ?? "?" })} ---`;
          setLogs((prev) => [
            ...prev,
            {
              stream: "stdout",
              text: endText,
              timestamp: Date.now(),
              category: "engine",
              level: "info",
            },
          ]);
        }
      });
      cleanups.push(unlistenStopped);

      unlisteners.current = cleanups;
    }

    setup();

    return () => {
      for (const unlisten of unlisteners.current) {
        unlisten();
      }
    };
  }, [instanceName]);

  const launch = useCallback(
    async (
      name: string,
      javaPath: string,
      args: string[],
    ) => {
      setStatus({ type: "launching" });
      const launchText = `[INFO] ${i18n.t("launch.launchingWithPath", { path: javaPath })}`;
      setLogs((prev) => [
        ...prev,
        {
          stream: "stdout",
          text: launchText,
          timestamp: Date.now(),
          category: "engine",
          level: "info",
        },
      ]);

      try {
        const result = await invoke<{ success: boolean; pid?: number; error?: string }>(
          "launch_instance",
          {
            instanceName: name,
            javaPath,
            args,
          },
        );

        if (result.success && result.pid) {
          setStatus({ type: "running", pid: result.pid });
          const pidText = `[INFO] ${i18n.t("console.processRunning", { pid: result.pid })}`;
          setLogs((prev) => [
            ...prev,
            {
              stream: "stdout",
              text: pidText,
              timestamp: Date.now(),
              category: "engine",
              level: "info",
            },
          ]);
        } else {
          setStatus({ type: "error", message: result.error || i18n.t("errors.unknown") });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : i18n.t("errors.launchFailed");
        setStatus({ type: "error", message });
        const errText = `[ERROR] ${message}`;
        setLogs((prev) => [
          ...prev,
          {
            stream: "stderr",
            text: errText,
            timestamp: Date.now(),
            category: "engine",
            level: "error",
          },
        ]);
      }
    },
    [],
  );

  const stop = useCallback(async (name: string) => {
    try {
      await invoke("stop_instance", { instanceName: name });
    } catch (err) {
      console.error("Failed to stop instance:", err);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    recentLinesRef.current.clear();
    recentOrderRef.current = [];
  }, []);

  return { status, logs, launch, stop, clearLogs };
}
