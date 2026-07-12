import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { InstanceManifest } from "@/types/instance";
import { cn } from "@/lib/utils";
import { LaunchButton } from "@/components/LaunchButton";
import type { LaunchStatus } from "@/hooks/useLaunch";
import { QuickPlay } from "@/components/QuickPlay";
import EditInstanceDialog from "@/components/EditInstanceDialog";
import DeleteInstanceDialog from "@/components/DeleteInstanceDialog";
import CloneInstanceDialog from "@/components/CloneInstanceDialog";
import ExportInstanceDialog from "@/components/ExportInstanceDialog";
import OpenFolderButton from "@/components/OpenFolderButton";

interface HeroCardProps {
  instance: InstanceManifest;
  launchStatus: LaunchStatus;
  onLaunch: () => void;
  onStop: () => void;
  canLaunch: boolean;
  onUpdated?: () => void;
  onDeleted?: () => void;
  onOpenConsole?: () => void;
  onQuickPlay?: (ip: string, port?: number) => void;
}

const loaderBadge: Record<string, { label: string; color: string }> = {
  vanilla: {
    label: "Vanilla",
    color:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  fabric: {
    label: "Fabric",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  neoforge: {
    label: "NeoForge",
    color: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  },
};

function HeroCard({ instance, launchStatus, onLaunch, onStop, canLaunch, onUpdated, onDeleted, onOpenConsole, onQuickPlay }: HeroCardProps) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const ramGB = (instance.ram / 1024).toFixed(1);
  const badge = (loaderBadge[instance.loader] ?? loaderBadge.vanilla)!;
  const loaderLabel =
    instance.loader === "fabric"
      ? t("loader.fabricVersion", { version: instance.loaderVersion })
      : instance.loader === "neoforge"
        ? t("loader.neoforgeVersion", { version: instance.loaderVersion })
        : t("loader.vanilla");

  const isRunning = launchStatus.type === "running";

  return (
    <>
      <div className={cn(
        "group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card/90 to-card/60 p-6 md:p-8 backdrop-blur-xl transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 animate-fade-in",
        launchStatus.type === "running"
          ? "border-emerald-500/30"
          : "border-border/50",
      )}>
        {/* Portal glow */}
        <div className="pointer-events-none absolute -inset-px animate-portal-pulse rounded-2xl opacity-50" />

        <div className="relative flex flex-col gap-5">
          {/* Top section: icon + info + play button */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Icon */}
              <div className="flex h-14 w-14 shrink-0 md:h-16 md:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 text-xl md:text-2xl font-bold text-primary shadow-lg shadow-primary/10">
                {instance.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">
                  {instance.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-sm text-muted-foreground">
                    MC {instance.mcVersion}
                  </span>
                  <span className="text-muted-foreground/30 hidden sm:inline">
                    ·
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium",
                      badge.color
                    )}
                  >
                    {loaderLabel}
                  </span>
                  <span className="text-muted-foreground/30 hidden sm:inline">
                    ·
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">
                    {ramGB} GB
                  </span>
                </div>
              </div>
            </div>

            {/* Play button (desktop) */}
            <div className="hidden md:block">
              <LaunchButton
                status={launchStatus}
                onLaunch={onLaunch}
                onStop={onStop}
                canLaunch={canLaunch}
                size="hero"
              />
            </div>
          </div>

          {/* Quick Play section */}
          {onQuickPlay && (
            <QuickPlay
              instanceName={instance.name}
              onQuickPlay={onQuickPlay}
              disabled={isRunning}
            />
          )}

          {/* Action icons row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Play button (mobile) */}
            <div className="md:hidden">
              <LaunchButton
                status={launchStatus}
                onLaunch={onLaunch}
                onStop={onStop}
                canLaunch={canLaunch}
                size="default"
              />
            </div>

            <div className="h-6 w-px bg-border/50 mx-1" />

            {/* Edit */}
            <button
              onClick={() => !isRunning && setEditOpen(true)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                isRunning
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-accent",
              )}
              title={isRunning ? t("instance.unavailableWhileRunning") : t("instance.edit")}
              disabled={isRunning}
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
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>

            {/* Clone */}
            <button
              onClick={() => !isRunning && setCloneOpen(true)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                isRunning
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-accent",
              )}
              title={isRunning ? t("instance.unavailableWhileRunning") : t("instance.clone")}
              disabled={isRunning}
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
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>

            {/* Export */}
            <button
              onClick={() => !isRunning && setExportOpen(true)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                isRunning
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-accent",
              )}
              title={isRunning ? t("instance.unavailableWhileRunning") : t("instance.export")}
              disabled={isRunning}
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            {/* Open folder */}
            <OpenFolderButton
              instanceName={instance.name}
              iconOnly
            />

            {/* Delete */}
            <button
              onClick={() => !isRunning && setDeleteOpen(true)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all",
                isRunning
                  ? "text-muted-foreground/20 cursor-not-allowed"
                  : "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10",
              )}
              title={isRunning ? t("instance.unavailableWhileRunning") : t("instance.delete")}
              disabled={isRunning}
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
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>

            {/* Console (visible only when game is running) */}
            {launchStatus.type === "running" && (
              <button
                onClick={onOpenConsole}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                title={t("instance.console")}
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
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <EditInstanceDialog
        instanceName={instance.name}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onUpdated}
      />
      <DeleteInstanceDialog
        instanceName={instance.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted ?? onUpdated}
      />
      <CloneInstanceDialog
        sourceName={instance.name}
        open={cloneOpen}
        onOpenChange={setCloneOpen}
      />
      <ExportInstanceDialog
        instanceName={instance.name}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </>
  );
}

export default HeroCard;
