import { useTranslation } from "react-i18next";
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

function SettingsDialog({ children }: SettingsDialogProps) {
  const { t, i18n } = useTranslation();

  return (
    <Dialog>
      {children && <DialogTrigger>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.microsoftReady")}
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

          <p>{t("settings.microsoftInfo")}</p>
          <p>{t("settings.microsoftSidebarHint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
