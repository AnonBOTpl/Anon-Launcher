import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DependencyInfo } from "@/lib/dependency-resolver";

interface MissingDepsWarningProps {
  dependencies: DependencyInfo[];
  hasMissing: boolean;
  hasConflicts: boolean;
  circularDetected: boolean;
  loading: boolean;
  installing: boolean;
  modName: string;
  onInstallDeps: (selectedOptionalIds: string[]) => void;
  onCancel: () => void;
}

function DependencyItem({
  dep,
  isOptionalSelected,
  onToggleOptional,
}: {
  dep: DependencyInfo;
  isOptionalSelected?: boolean;
  onToggleOptional?: (projectId: string) => void;
}) {
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
        {/* Toggle for optional not-installed deps */}
        {dep.type === "optional" && !dep.installed && onToggleOptional && (
          <button
            onClick={() => onToggleOptional(dep.projectId)}
            className={cn(
              "relative h-4 w-7 shrink-0 rounded-full transition-colors",
              isOptionalSelected ? "bg-amber-500" : "bg-muted-foreground/20 ring-1 ring-inset ring-border",
            )}
            title={isOptionalSelected ? "Nie instaluj" : "Instaluj"}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform shadow-sm",
                isOptionalSelected && "translate-x-3",
              )}
            />
          </button>
        )}

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
        {dep.type === "optional" && !dep.installed && !isOptionalSelected && (
          <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-400 font-medium">Opcjonalne</span>
        )}
        {dep.type === "optional" && !dep.installed && isOptionalSelected && (
          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] text-amber-300 font-medium ring-1 ring-amber-500/30">Instaluj</span>
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
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<Set<string>>(new Set());

  const toggleOptional = (projectId: string) => {
    setSelectedOptionalIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const installableCount = dependencies.filter(
    (d) => d.type === "required" && !d.installed,
  ).length;

  const optionalSelectedCount = dependencies.filter(
    (d) => d.type === "optional" && !d.installed && selectedOptionalIds.has(d.projectId),
  ).length;

  const totalToInstall = installableCount + optionalSelectedCount;

  const handleInstall = () => {
    onInstallDeps([...selectedOptionalIds]);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4 animate-fade-in space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {hasConflicts ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
        ) : hasMissing || optionalSelectedCount > 0 ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Zależności modów</h3>
          <p className="text-[11px] text-muted-foreground">
            {loading
              ? "Sprawdzanie zależności..."
              : circularDetected
                ? `Wykryto cykliczną zależność dla ${modName}`
                : hasConflicts
                  ? `${modName} jest niezgodny z zainstalowanymi modami`
                  : hasMissing || optionalSelectedCount > 0
                    ? `${modName} wymaga ${totalToInstall} modów`
                    : `Wszystkie zależności dla ${modName} są już zainstalowane`}
          </p>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex items-center justify-center py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
        </div>
      )}

      {/* Installing state */}
      {installing && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
          <p className="text-xs text-muted-foreground">
            Pobieranie i instalowanie modów dla <span className="text-foreground font-medium">{modName}</span>...
          </p>
        </div>
      )}

      {/* Dependency list */}
      {!loading && !installing && dependencies.length > 0 && (
        <div className="space-y-0.5 rounded-lg border border-border/50 bg-card/50 p-2">
          {dependencies.map((dep, i) => (
            <DependencyItem
              key={`${dep.projectId}-${i}`}
              dep={dep}
              isOptionalSelected={selectedOptionalIds.has(dep.projectId)}
              onToggleOptional={toggleOptional}
            />
          ))}
        </div>
      )}

      {/* Circular warning */}
      {!loading && circularDetected && (
        <p className="text-xs text-destructive/80">
          Wykryto zapętlenie zależności. Instalacja może nie być możliwa.
        </p>
      )}

      {/* Actions — zawsze widoczne gdy nie ma loading/installing */}
      {!loading && !installing && (
        <div className="flex items-center gap-2 justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="text-xs"
          >
            Anuluj
          </Button>

          {!circularDetected && !hasConflicts && (
            <Button
              size="sm"
              onClick={handleInstall}
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-lg shadow-purple-500/20 text-xs"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {totalToInstall > 0
                ? `Zainstaluj ${totalToInstall} zależności`
                : "Zainstaluj mod"}
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
      )}
    </div>
  );
}
