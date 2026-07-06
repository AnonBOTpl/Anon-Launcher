import { useRef, useEffect, useState, useMemo } from "react";
import type { LogLine, LogCategory, LogLevel } from "@/hooks/useLaunch";
import { cn } from "@/lib/utils";

interface GameConsoleProps {
  logs: LogLine[];
  onClear?: () => void;
  maxHeight?: string;
}

/** Tab configuration */
interface TabDef {
  key: LogCategory;
  label: string;
}

const TABS: TabDef[] = [
  { key: "all", label: "Wszystkie" },
  { key: "fabric", label: "Fabric" },
  { key: "engine", label: "Silnik" },
];

/** Level filter buttons */
interface LevelFilter {
  key: LogLevel;
  label: string;
  color: string;
}

const LEVEL_FILTERS: LevelFilter[] = [
  { key: "all", label: "All", color: "text-[#CCC]" },
  { key: "info", label: "INFO", color: "text-blue-400" },
  { key: "warn", label: "WARN", color: "text-yellow-400" },
  { key: "error", label: "ERROR", color: "text-red-400" },
  { key: "debug", label: "DEBUG", color: "text-gray-500" },
];

/**
 * Get color class for a log line based on its level and content
 */
function getLineColor(line: LogLine): string {
  if (line.stream === "stderr") return "text-red-400";
  if (line.level === "error") return "text-red-400";
  if (line.level === "warn") return "text-yellow-400";
  if (line.level === "debug") return "text-gray-500";
  if (line.level === "info") return "text-blue-300";
  return "text-[#D4D4D4]";
}

/**
 * Extract a short prefix like [thread/LEVEL] for display
 */
function extractPrefix(text: string): string | null {
  const match = text.match(/^(\[.*?\]\s+\[.*?\]):?\s*/);
  return match ? (match[1] ?? null) : null;
}

/**
 * Game console component styled like a terminal.
 * Displays Minecraft stdout/stderr logs with auto-scroll,
 * categorized tabs (All / Fabric / Engine), level filtering,
 * and text search.
 */
export function GameConsole({ logs, onClear, maxHeight = "300px" }: GameConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<LogCategory>("all");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter logs based on active tab, level filter and search
  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      // Tab filter
      if (activeTab !== "all" && line.category !== activeTab) return false;
      // Level filter
      if (levelFilter !== "all" && line.level !== levelFilter) return false;
      // Search filter (case-insensitive)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!line.text.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, activeTab, levelFilter, searchQuery]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Keyboard shortcut: Ctrl+F to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const hasFilters = levelFilter !== "all" || searchQuery.length > 0;
  const filteredCount = filteredLogs.length;
  const totalCount = logs.length;

  return (
    <div
      className="rounded-xl border border-border/50 overflow-hidden bg-[#1E1E1E] flex flex-col"
      style={{ maxHeight }}
    >
      {/* ─── Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col shrink-0 border-b border-[#333]">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                logs.length > 0 ? "bg-green-500 animate-pulse" : "bg-purple-500",
              )}
            />
            <span className="text-xs font-mono text-[#CCC]">Konsola</span>
            <span className="text-[10px] text-muted-foreground">
              {hasFilters
                ? `${filteredCount}/${totalCount} linii`
                : `${totalCount} linii`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded text-[11px] transition-colors",
                autoScroll
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={autoScroll ? "Auto-scroll włączony" : "Auto-scroll wyłączony"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {/* Clear */}
            {onClear && (
              <button
                onClick={onClear}
                className="flex h-6 w-6 items-center justify-center rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                title="Wyczyść"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs row */}
        <div className="flex items-center gap-0.5 px-2 pb-1">
          {TABS.map((tab) => {
            const count = tab.key === "all"
              ? logs.length
              : logs.filter((l) => l.category === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded-t transition-colors",
                  activeTab === tab.key
                    ? "text-white bg-[#2A2A2A]"
                    : "text-[#888] hover:text-[#CCC] hover:bg-[#252525]",
                )}
              >
                {tab.key === "fabric" && (
                  <span className="text-[10px]">🧵</span>
                )}
                {tab.key === "engine" && (
                  <span className="text-[10px]">⚙️</span>
                )}
                {tab.label}
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Level filter + Search row */}
        <div className="flex items-center gap-2 px-3 pb-2">
          {/* Level filter buttons */}
          <div className="flex items-center gap-0.5">
            {LEVEL_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setLevelFilter(levelFilter === f.key ? "all" : f.key)}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors",
                  levelFilter === f.key
                    ? `${f.color} bg-[#2A2A2A] ring-1 ring-[#444]`
                    : "text-[#666] hover:text-[#999]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#666] pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj... (Ctrl+F)"
              className="w-36 h-6 rounded bg-[#252525] border border-[#444] pl-6 pr-2 text-[11px] font-mono text-[#CCC] placeholder-[#555] outline-none focus:border-purple-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#CCC] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Log content ─────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-xs leading-relaxed p-3 flex-1 min-h-0"
      >
        {logs.length === 0 ? (
          <p className="text-[#6A9955] italic">
            [INFO] Konsola gotowa — uruchom instancję aby zobaczyć logi.
          </p>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#555]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mb-2 opacity-50"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <p className="text-xs italic">Brak pasujących linii dla wybranych filtrów</p>
          </div>
        ) : (
          filteredLogs.map((line, i) => {
            const prefix = extractPrefix(line.text);
            const body = prefix
              ? line.text.slice(prefix.length).replace(/^:\s*/, "")
              : line.text;

            return (
              <div
                key={`${line.timestamp}-${i}`}
                className={cn(
                  "whitespace-pre-wrap break-all hover:bg-white/[0.03] rounded px-0.5 transition-colors",
                  getLineColor(line),
                  line.stream === "stderr" && "bg-red-900/10",
                )}
              >
                {prefix ? (
                  <>
                    <span className="text-[#888]">{prefix}</span>
                    <span className="text-[#666]">: </span>
                    <span>{body}</span>
                  </>
                ) : (
                  line.text
                )}
              </div>
            );
          })
        )}
        {logs.length > 0 && (
          <span className="text-[#6A9955] mt-1 block">$ _</span>
        )}
      </div>
    </div>
  );
}
