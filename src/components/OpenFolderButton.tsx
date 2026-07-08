import { useTranslation } from "react-i18next";
import { useOpenFolder } from "@/hooks/useOpenFolder";

interface OpenFolderButtonProps {
  instanceName: string;
  disabled?: boolean;
  iconOnly?: boolean;
}

function OpenFolderButton({ instanceName, disabled, iconOnly }: OpenFolderButtonProps) {
  const { t } = useTranslation();
  const { openFolder, opening, error } = useOpenFolder();

  if (iconOnly) {
    return (
      <>
        <button
          onClick={() => openFolder(instanceName)}
          disabled={disabled || opening}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
          title={t("instance.openFolder")}
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
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </>
    );
  }

  return (
    <div>
      <button
        onClick={() => openFolder(instanceName)}
        disabled={disabled || opening}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
        title={t("instance.openFolder")}
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
        {opening ? t("instance.opening") : t("instance.openFolder")}
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export default OpenFolderButton;
