import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DependencyInfo } from "@/lib/dependency-resolver";

interface MissingDepsWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependencies: DependencyInfo[];
  hasMissing: boolean;
  hasConflicts: boolean;
  circularDetected: boolean;
  loading: boolean;
  installing: boolean;
  modName: string;
  onInstallDeps: () => void;
  onCancel: () => void;
}

function DependencyItem({ dep }: { dep: DependencyInfo }) {
  const indent = dep.depth * 12;

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          dep.installed && "opacity-60",
        )}
        style={{ marginLeft: indent }}
      >
        {/* Status icon */}
        {dep.installed ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-400">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : dep.type === "incompatible" ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-400">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-amber-400">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}

        {/* Icon */}
        {dep.iconUrl ? (
          <img src={dep.iconUrl} alt="" className="h-5 w-5 rounded object-cover" />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[9px] font-bold text-muted-foreground">
            {dep.modName?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}

        {/* Name + type badge */}
        <span className="truncate flex-1">{dep.modName || dep.projectId}</span>
        {dep.type === "required" && !dep.installed && (
          <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[9px] text-destructive font-medium">Wymagane</span>
        )}
        {dep.type === "optional" && (
          <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400 font-medium">Opcjonalne</span>
        )}
        {dep.type === "incompatible" && (
          <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-400 font-medium">Niezgodne</span>
        )}
        {dep.installed && (
          <span className="shrink-0 text-[10px] text-emerald-400">Zainstalowane</span>
        )}
      </div>

      {/* Render children (transitive deps) */}
      {dep.children?.map((child, i) => (
        <DependencyItem key={`${child.projectId}-${i}`} dep={child} />
      ))}
    </>
  );
}

export default function MissingDepsWarning({
  open,
  dependencies,
  hasMissing,
  hasConflicts,
  circularDetected,
  loading,
  installing,
  modName,
  onInstallDeps,
  onCancel,
}: MissingDepsWarningProps) {
  if (!open) return null;

  const installableCount = dependencies.filter(
    (d) => d.type === "required" && !d.installed,
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={installing ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl border border-border/50 bg-card p-6 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Instalacja w toku */}
        {installing ? (
          <>
            <div className="flex items-start gap-3 mb-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/20">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Instalowanie zależności</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pobieranie i instalowanie wymaganych modów dla{' '}
                  <span className="text-foreground font-medium">{modName}</span>...
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-muted border-t-purple-500" />
              <p className="text-sm text-muted-foreground">To może zająć chwilę...</p>
              {/* Animated dots */}
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-purple-500/50 animate-bounce"
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
            </div>

            {/* Disabled cancel during install */}
            <div className="mt-4 flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="text-xs opacity-50"
              >
                Anuluj
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-3 mb-1">
              {hasConflicts ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              ) : hasMissing ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Zależności modów</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {loading
                    ? "Sprawdzanie zależności..."
                    : circularDetected
                      ? `Wykryto cykliczną zależność dla ${modName}`
                      : hasConflicts
                        ? `${modName} jest niezgodny z zainstalowanymi modami`
                        : hasMissing
                          ? `${modName} wymaga ${installableCount} brakujących modów`
                          : `Wszystkie zależności dla ${modName} są już zainstalowane`}
                </p>
              </div>
            </div>

            {/* Loading spinner */}
            {loading && (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              </div>
            )}

            {/* Dependency list */}
            {!loading && dependencies.length > 0 && (
              <div className="mt-3 space-y-0.5 rounded-lg border border-border/50 bg-card/50 p-2">
                {dependencies.map((dep, i) => (
                  <DependencyItem key={`${dep.projectId}-${i}`} dep={dep} />
                ))}
              </div>
            )}

            {/* Circular warning */}
            {!loading && circularDetected && (
              <p className="mt-2 text-xs text-destructive/80">
                Wykryto zapętlenie zależności. Instalacja może nie być możliwa.
              </p>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="text-xs"
              >
                {hasMissing ? "Anuluj" : "OK"}
              </Button>

              {hasMissing && !circularDetected && (
                <Button
                  size="sm"
                  onClick={onInstallDeps}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20 text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Zainstaluj {installableCount} zależności
                </Button>
              )}

              {hasConflicts && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onCancel}
                  className="text-xs"
                >
                  Anuluj instalację
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
