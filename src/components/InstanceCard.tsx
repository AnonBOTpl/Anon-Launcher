import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InstanceManifest, LoaderType } from "@/types/instance";
import { cn } from "@/lib/utils";
import DeleteInstanceDialog from "@/components/DeleteInstanceDialog";
import EditInstanceDialog from "@/components/EditInstanceDialog";

interface InstanceCardProps {
  instance: InstanceManifest;
  onDeleted?: () => void;
}

const loaderColors: Record<LoaderType, string> = {
  vanilla: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  fabric: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
};

function InstanceCard({ instance, onDeleted }: InstanceCardProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const ramGB = (instance.ram / 1024).toFixed(1);

  return (
    <>
      <div
        onClick={() => navigate(`/instance/${encodeURIComponent(instance.name)}`)}
        className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-foreground/20 active:scale-[0.98]"
      >
        {/* Top row: icon + actions */}
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
            {instance.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex items-center gap-1">
            {/* Edit button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditDialogOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all hover:text-foreground group-hover:opacity-100 hover:bg-accent"
              aria-label={`Edytuj ${instance.name}`}
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
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all hover:text-destructive group-hover:opacity-100 hover:bg-destructive/10"
              aria-label={`Usuń ${instance.name}`}
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
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>

            {/* Navigate to instance — arrow icon instead of misleading play */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/instance/${encodeURIComponent(instance.name)}`);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/90"
              aria-label={`Otwórz ${instance.name}`}
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
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

      {/* Instance info */}
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold leading-tight truncate">{instance.name}</h3>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">MC {instance.mcVersion}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono">{ramGB} GB</span>
        </div>
      </div>

      {/* Badge row */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            loaderColors[instance.loader]
          )}
        >
          {instance.loader === "vanilla"
            ? "Vanilla"
            : `Fabric ${instance.loaderVersion}`}
        </span>
      </div>
    </div>

      {/* Edit dialog */}
      <EditInstanceDialog
        instanceName={instance.name}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={onDeleted}
      />

      {/* Delete dialog */}
      <DeleteInstanceDialog
        instanceName={instance.name}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}

export default InstanceCard;
