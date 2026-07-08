import { X, ArrowUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UpdateInfo } from "@/hooks/useUpdater";

interface UpdateBannerProps {
  update: UpdateInfo;
  onOpenRelease: () => void;
}

export function UpdateBanner({ update, onOpenRelease }: UpdateBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-1.5 bg-purple-500/8 border-b border-purple-500/20 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <ArrowUp size={14} className="text-purple-400 shrink-0" />
        <span className="text-muted-foreground truncate">
          {t("update.available")}{" "}
          <span className="font-semibold text-foreground">
            {t("update.version", { version: update.version })}
          </span>
        </span>
        <button
          onClick={onOpenRelease}
          className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 transition-colors shrink-0"
        >
          {t("update.download")}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
        aria-label={t("common.close")}
      >
        <X size={14} />
      </button>
    </div>
  );
}
