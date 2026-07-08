import { useMemo } from "react";

interface CrashReportViewerProps {
  filename: string;
  content: string;
  fileSize: number;
  onClose: () => void;
  onOpenFolder: () => void;
  onDelete: () => void;
}

/**
 * Formats a file size in bytes to a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Highlight key parts of crash report text.
 * - Stack frames (at ...) in cyan
 * - Error/Exception lines in red
 * - JVM header lines (# ...) in yellow
 * - Thread names in green
 */
function highlightCrashText(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line;
    let className = "text-[#D4D4D4]";

    // JVM header lines (#)
    if (trimmed.startsWith("#") && !trimmed.startsWith("##")) {
      className = "text-amber-400/90";
    } else if (trimmed.startsWith("##")) {
      className = "text-amber-400/60";
    }
    // Stack frames: "at some.package.Class.method(File.java:123)"
    else if (/^\s+at\s+\w+\./.test(trimmed)) {
      className = "text-cyan-300";
    }
    // Exception/Error lines
    else if (
      /^(Exception|Error|Caused by:|java\.lang\.|net\.minecraft\.)/.test(trimmed) ||
      /EXCEPTION_ACCESS_VIOLATION|SIGSEGV|SIGABRT/.test(trimmed)
    ) {
      className = "text-red-400 font-semibold";
    }
    // Thread info: [thread name/LEVEL]
    else if (/^\[.*?\]\s+\[/.test(trimmed)) {
      className = "text-emerald-300";
    }
    // More lines: "More: ..."
    else if (/^More:/i.test(trimmed)) {
      className = "text-muted-foreground";
    }
    // Native frame: "# C  [library.dll+...]"
    else if (/^#\s+[CJ]\s+\[/.test(trimmed)) {
      className = "text-orange-300";
    }

    return (
      <div key={i} className={`whitespace-pre-wrap break-all ${className} leading-relaxed`}>
        {line || "\u00A0"}
      </div>
    );
  });
}

/**
 * Crash report viewer — shows full crash report content with
 * syntax highlighting for stack traces and JVM crash headers.
 */
export function CrashReportViewer({
  filename,
  content,
  fileSize,
  onClose,
  onOpenFolder,
  onDelete,
}: CrashReportViewerProps) {
  const highlightedContent = useMemo(
    () => highlightCrashText(content),
    [content],
  );

  // Determine crash type from filename
  const isJvm = filename.startsWith("hs_err");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-card/40 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
              isJvm
                ? "bg-red-500/15 text-red-400"
                : "bg-orange-500/15 text-orange-400"
            }`}>
              {isJvm ? "☠" : "📄"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {isJvm ? "JVM Crash" : "Minecraft Crash"} · {formatFileSize(fileSize)}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Zamknij podgląd"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[#0A0A0F] p-4 font-mono text-xs leading-relaxed min-h-0">
        {highlightedContent}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/50 px-4 py-3 bg-card/40 shrink-0">
        <button
          onClick={onOpenFolder}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/50 bg-card/60 px-3 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
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
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Otwórz folder
        </button>
        <button
          onClick={onDelete}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
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
          >
            <path d="M3 6h18" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
          Usuń
        </button>
      </div>
    </div>
  );
}
