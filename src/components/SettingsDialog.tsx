import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SettingsDialogProps {
  children?: React.ReactNode;
}

const CLOSE_ON_LAUNCH_KEY = "anon_close_on_launch";

function SettingsDialog({ children }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();
  const [closeOnLaunch, setCloseOnLaunch] = useState(() => {
    return localStorage.getItem(CLOSE_ON_LAUNCH_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(CLOSE_ON_LAUNCH_KEY, String(closeOnLaunch));
  }, [closeOnLaunch]);

  return (
    <Dialog>
      {children && <DialogTrigger>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 text-sm text-muted-foreground">
          {/* Language selector */}
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="language-select" className="font-medium text-foreground">
              {t("settings.language")}
            </label>
            <select
              id="language-select"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
            >
              <option value="en">English</option>
              <option value="pl">Polski</option>
            </select>
          </div>

          <hr className="border-border/50" />

          {/* Close on launch toggle */}
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="font-medium text-foreground">{t("settings.afterLaunch")}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{t("settings.afterLaunchDesc")}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={closeOnLaunch}
              onClick={() => setCloseOnLaunch(!closeOnLaunch)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                closeOnLaunch
                  ? "bg-purple-500"
                  : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  closeOnLaunch ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
