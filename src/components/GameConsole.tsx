import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { LogLine, LogCategory, LogLevel } from "@/hooks/useLaunch";
import { cn } from "@/lib/utils";

interface GameConsoleProps {
  logs: LogLine[];
  onClear?: () => void;
  maxHeight?: string;
}

/** Level filter buttons */
const LEVEL_FILTERS: { key: LogLevel; label: string }[] = [
  { key: "all", label: "All" },
  { key: "info", label: "INFO" },
  { key: "warn", label: "WARN" },
  { key: "error", label: "ERROR" },
  { key: "debug", label: "DEBUG" },
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
 * Determine if content is scrolled to the bottom (within threshold).
 */
function isScrolledToBottom(el: HTMLElement, threshold = 30): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

/**
 * Game console component styled to match the app's purple/slate theme.
 * Displays Minecraft stdout/stderr logs with auto-scroll,
 * categorized tabs (All / Fabric / Engine), level filtering,
 * and text search.
 */
const TABS_KEYS: { key: LogCategory; labelKey: string }[] = [
  { key: "all", labelKey: "console.filterAll" },
  { key: "fabric", labelKey: "console.filterFabric" },
  { key: "engine", labelKey: "console.filterEngine" },
];

export function GameConsole({ logs, onClear, maxHeight = "300px" }: GameConsoleProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<LogCategory>("all");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNewLogs, setHasNewLogs] = useState(false);

  // Filter logs based on active tab, level filter and search
  const filteredLogs = useMemo(() => {
    return logs.filter((line) => {
      if (activeTab !== "all" && line.category !== activeTab) return false;
      if (levelFilter !== "all" && line.level !== levelFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!line.text.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, activeTab, levelFilter, searchQuery]);

  // Track if user scrolled up — disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const atBottom = isScrolledToBottom(scrollRef.current);
    setAutoScroll(atBottom);
  }, []);

  // Auto-scroll when new logs arrive, but only if user is at the bottom
  const prevLogsLength = useRef(filteredLogs.length);
  useEffect(() => {
    if (filteredLogs.length > prevLogsLength.current) {
      setHasNewLogs(true);
      prevLogsLength.current = filteredLogs.length;
    }
  }, [filteredLogs.length]);

  useEffect(() => {
    if (autoScroll && scrollRef.current && hasNewLogs) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (scrollRef.current && autoScroll) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
      setHasNewLogs(false);
    }
  }, [filteredLogs, autoScroll, hasNewLogs]);

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
      className="rounded-xl border border-border/50 overflow-hidden bg-card/60 backdrop-blur-sm flex flex-col"
      style={{ maxHeight }}
    >
      {/* ─── Toolbar ─────────────────────────────────────── */}
      <div className="flex flex-col shrink-0 border-b border-border/50 bg-card/40">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                logs.length > 0 ? "bg-emerald-500 animate-pulse" : "bg-primary",
              )}
            />
            <span className="text-sm font-medium text-foreground">{t("console.title")}</span>
            <span className="text-xs text-muted-foreground">
              {hasFilters
                ? `${filteredCount}/${totalCount} linii`
                : `${totalCount} linii`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all",
                autoScroll
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
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
              {autoScroll ? t("console.autoscroll") : t("console.manual")}
            </button>
            {/* Clear */}
            {onClear && (
              <button
                onClick={onClear}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                title={t("console.clear")}
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
                {t("console.clear")}
              </button>
            )}
          </div>
        </div>

        {/* Tabs + filters row */}
        <div className="flex items-center gap-3 px-4 pb-2.5 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {TABS_KEYS.map((tab) => {
              const count = tab.key === "all"
                ? logs.length
                : logs.filter((l) => l.category === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "relative px-2.5 py-1 text-xs font-medium rounded-md transition-all",
                    activeTab === tab.key
                      ? "bg-primary/15 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  {t(tab.labelKey)}
                  <span className="ml-1 text-[10px] opacity-60">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-border/50" />

          {/* Level filter buttons */}
          <div className="flex items-center gap-1">
            {LEVEL_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setLevelFilter(levelFilter === f.key ? "all" : f.key)}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors",
                  levelFilter === f.key
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-[8px]" />

          {/* Search */}
          <div className="relative">
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
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${t("console.search")} (Ctrl+F)`}
              className="w-40 h-7 rounded-lg bg-muted/50 border border-border/50 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
        onScroll={handleScroll}
        className="overflow-y-auto font-mono text-xs leading-relaxed p-3 flex-1 min-h-0 bg-[#0A0A0F] custom-scrollbar"
      >
        {logs.length === 0 ? (
          <p className="text-primary/60 italic text-center py-8">
            {t("console.ready")}
          </p>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
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
            <p className="text-xs italic">{t("console.noMatches")}</p>
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
                  "whitespace-pre-wrap break-all hover:bg-white/[0.03] rounded px-0.5 transition-colors py-px",
                  getLineColor(line),
                  line.stream === "stderr" && "bg-red-900/10",
                )}
              >
                {prefix ? (
                  <>
                    <span className="text-muted-foreground/60">{prefix}</span>
                    <span className="text-muted-foreground/40">: </span>
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
          <span className="text-primary/60 mt-1 block">$ _</span>
        )}

        {/* New logs indicator when auto-scroll is off */}
        {!autoScroll && !hasFilters && filteredLogs.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 mt-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-medium hover:bg-primary/30 transition-all shadow-lg backdrop-blur-sm"
          >
            ⬇ {t("console.newLogs")}
          </button>
        )}
      </div>
    </div>
  );
}
