import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getServerHistory,
  addServerEntry,
  removeServerEntry,
  parseServerAddress,
  type ServerEntry,
} from "@/lib/server-history";

interface QuickPlayProps {
  /** Instance name for history lookup */
  instanceName: string;
  /** Called when user wants to quick-play to a server */
  onQuickPlay: (ip: string, port?: number) => void;
  /** Disabled while game is running */
  disabled?: boolean;
}

export function QuickPlay({
  instanceName,
  onQuickPlay,
  disabled,
}: QuickPlayProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [history, setHistory] = useState<ServerEntry[]>(() =>
    getServerHistory(instanceName),
  );
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh history when instanceName changes
  useEffect(() => {
    setHistory(getServerHistory(instanceName));
  }, [instanceName]);

  const handlePlay = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setInputError(t("quickPlay.enterAddress"));
      return;
    }

    const { ip, port } = parseServerAddress(trimmed);
    if (!ip) {
      setInputError(t("quickPlay.invalidAddress"));
      return;
    }

    setInputError(null);
    // Save to history and update local state
    addServerEntry(instanceName, ip, port);
    setHistory(getServerHistory(instanceName));
    setInputValue("");
    onQuickPlay(ip, port);
  }, [inputValue, instanceName, onQuickPlay, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handlePlay();
      }
    },
    [handlePlay],
  );

  const handleBadgeClick = useCallback(
    (entry: ServerEntry) => {
      setInputValue("");
      setInputError(null);
      onQuickPlay(entry.address, entry.port);
    },
    [onQuickPlay],
  );

  const handleRemoveBadge = useCallback(
    (e: React.MouseEvent, entry: ServerEntry) => {
      e.stopPropagation();
      removeServerEntry(instanceName, entry.address);
      setHistory(getServerHistory(instanceName));
    },
    [instanceName],
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm transition-all duration-300 hover:border-primary/20">
      {/* ── Input row ──────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t("quickPlay.placeholder")}
            disabled={disabled}
            className={cn(
              "h-9 w-full rounded-lg border bg-card/80 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all",
              inputError
                ? "border-destructive/50 focus:ring-destructive/30"
                : "border-border/50 focus:ring-primary/30 focus:border-primary/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
            aria-label={t("quickPlay.placeholder")}
          />
        </div>

        {/* Play button */}
        <button
          onClick={handlePlay}
          disabled={disabled || !inputValue.trim()}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all",
            disabled || !inputValue.trim()
              ? "cursor-not-allowed bg-muted/50 text-muted-foreground/30"
              : "bg-primary/15 text-primary hover:bg-primary/25 hover:text-primary active:scale-95",
          )}
          title={t("quickPlay.connect")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </button>
      </div>

      {/* Error message */}
      {inputError && (
        <p className="mt-1.5 text-xs text-destructive">{inputError}</p>
      )}

      {/* ── History buttons ────────────────────────────── */}
      {history.length > 0 && !disabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {history.slice(0, 5).map((entry) => (
            <button
              key={entry.address}
              onClick={() => handleBadgeClick(entry)}
              className={cn(
                "group relative flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all duration-200",
                "border-border/40 bg-muted/20 text-muted-foreground",
                "hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:shadow-sm hover:shadow-primary/10",
                "active:scale-[0.97]",
              )}
              title={`${t("quickPlay.connectTo")} ${entry.address}${entry.port ? `:${entry.port}` : ""}`}
            >
              {/* Play icon — hidden by default, visible on hover */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="shrink-0 text-transparent group-hover:text-primary transition-all duration-200"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>

              {/* Server address */}
              <span className="truncate max-w-[130px] font-medium">
                {entry.address}
              </span>

              {/* Remove button (X) — visible on hover */}
              <span
                onClick={(e) => handleRemoveBadge(e, entry)}
                className={cn(
                  "ml-auto rounded p-0.5 opacity-0 transition-all duration-200",
                  "text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10",
                  "group-hover:opacity-100",
                )}
                title={t("quickPlay.remove")}
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
