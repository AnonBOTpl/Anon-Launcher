import type { CrashReport } from "@/lib/crash-reports";
import { CrashReportViewer } from "./CrashReportViewer";

interface CrashReportListProps {
  reports: CrashReport[];
  loading: boolean;
  error: string | null;
  selectedReport: string | null;
  selectedContent: string | null;
  contentLoading: boolean;
  onSelect: (filename: string | null) => void;
  onRefresh: () => void;
  onDelete: (filename: string) => void;
  onDeleteAll: () => void;
  onOpenFolder: () => void;
}

/**
 * Format file size to human-readable string.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format an ISO 8601 timestamp to a locale-friendly date/time.
 */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * CrashReportList — shows a list of crash reports with actions.
 * Left panel: list of reports.
 * Right panel: viewer when a report is selected, or empty state.
 */
export function CrashReportList({
  reports,
  loading,
  error,
  selectedReport,
  selectedContent,
  contentLoading,
  onSelect,
  onRefresh,
  onDelete,
  onDeleteAll,
  onOpenFolder,
}: CrashReportListProps) {
  // Find the currently selected report metadata
  const currentReport = reports.find((r) => r.filename === selectedReport) ?? null;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3 bg-card/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Raporty awarii</span>
          {reports.length > 0 && (
            <span className="text-xs text-muted-foreground">({reports.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reports.length > 0 && (
            <button
              onClick={onDeleteAll}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
              Usuń wszystkie
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
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
              className={loading ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-9-9" />
              <path d="M21 3v5h-5" />
            </svg>
            Odśwież
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 shrink-0">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Main content area */}
      {reports.length === 0 && !loading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/50"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">Brak raportów awarii</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Jeśli Minecraft ulegnie awarii, raport pojawi się tutaj automatycznie.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Możesz też odświeżyć ręcznie.
          </p>
        </div>
      ) : selectedReport && currentReport && selectedContent !== null ? (
        /* Viewer mode */
        <div className="flex-1 min-h-0">
          <CrashReportViewer
            filename={selectedReport}
            content={selectedContent}
            fileSize={currentReport.fileSize}
            onClose={() => onSelect(null)}
            onOpenFolder={onOpenFolder}
            onDelete={() => onDelete(selectedReport)}
          />
        </div>
      ) : contentLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-muted border-t-purple-500" />
            <p className="text-xs text-muted-foreground">Wczytywanie raportu...</p>
          </div>
        </div>
      ) : (
        /* List mode */
        <div className="flex-1 overflow-auto p-4 space-y-2 min-h-0">
          {reports.map((report) => {
            const isSelected = selectedReport === report.filename;
            const isJvm = report.crashType === "JVM";

            return (
              <button
                key={report.filename}
                onClick={() => onSelect(report.filename)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-purple-500/40 bg-purple-500/10 shadow-sm"
                    : "border-border/50 bg-card/40 hover:bg-accent/50 hover:border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm ${
                    isJvm
                      ? "bg-red-500/15 text-red-400"
                      : "bg-orange-500/15 text-orange-400"
                  }`}>
                    {isJvm ? "☠" : "📄"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {report.filename}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isJvm ? "JVM Crash" : "Minecraft Crash"} · {formatSize(report.fileSize)} · {formatTimestamp(report.timestamp)}
                    </p>
                    {report.preview && (
                      <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-2 font-mono">
                        {report.preview}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-3 ml-12">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(report.filename);
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-purple-400 hover:bg-purple-500/15 transition-colors cursor-pointer"
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
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Pokaż
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFolder();
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Otwórz folder
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(report.filename);
                    }}
                    className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
                      <path d="M3 6h18" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    Usuń
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
