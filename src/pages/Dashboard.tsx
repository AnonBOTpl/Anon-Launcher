import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInstances } from "@/hooks/useInstances";
import InstanceGrid from "@/components/InstanceGrid";
import ImportInstanceDialog from "@/components/ImportInstanceDialog";
import ImportFromLinkDialog from "@/components/ImportFromLinkDialog";

function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { instances, loading, error, refresh } = useInstances();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLinkOpen, setImportLinkOpen] = useState(false);

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/create")}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-4 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:from-primary/80 hover:to-primary transition-all"
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("dashboard.new")}
          </button>
          <button
            onClick={() => setImportLinkOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors backdrop-blur-sm"
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
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {t("dashboard.importLink")}
          </button>
          <button
            onClick={() => setImportDialogOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors backdrop-blur-sm"
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {t("dashboard.importZip")}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card/60 px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors backdrop-blur-sm disabled:opacity-50"
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
              className={loading ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-9-9" />
              <path d="M21 3v5h-5" />
            </svg>
            {t("dashboard.refresh")}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-8 pt-6">
        {/* Error state */}
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
              <p className="text-sm text-muted-foreground">{t("dashboard.loading")}</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && instances.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 py-32">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold">{t("dashboard.noInstances")}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t("dashboard.noInstancesHint")}
            </p>
            <button
              onClick={() => navigate("/create")}
              className="mt-8 inline-flex h-11 items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary transition-all duration-200"
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
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("dashboard.new")}
            </button>
          </div>
        )}

        {/* Instance grid with all instances — staggered animation */}
        {!loading && instances.length > 0 && (
          <div className="animate-page-enter">
            <InstanceGrid
              instances={instances}
              onInstanceDeleted={refresh}
            />
          </div>
        )}
      </div>

      {/* Import dialog */}
      <ImportInstanceDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={refresh}
      />
      <ImportFromLinkDialog
        open={importLinkOpen}
        onOpenChange={setImportLinkOpen}
        onImported={refresh}
      />
    </div>
  );
}

export default Dashboard;
