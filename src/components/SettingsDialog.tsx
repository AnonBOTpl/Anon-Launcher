import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AVAILABLE_LOCALES } from "@/lib/i18n";
import { ACCENT_PRESETS, getAccentHue, setAccentHue, applyAccentHue } from "@/lib/accents";
import { cn } from "@/lib/utils";
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
  const [selectedAccent, setSelectedAccent] = useState(getAccentHue());
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    applyAccentHue(getAccentHue());
  };

  const handleAccentSelect = (hue: number) => {
    setSelectedAccent(hue);
    setAccentHue(hue);
  };

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

        <div className="flex flex-col gap-6 py-2 text-sm text-muted-foreground">
          {/* ── Language ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              {t("settings.language")}
            </h3>
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
                {AVAILABLE_LOCALES.map((locale) => (
                  <option key={locale.code} value={locale.code}>
                    {locale.flag} {locale.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Theme (Dark/Light) ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              {t("settings.theme")}
            </h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { if (isDark) handleThemeToggle(); }}
                className={cn(
                  "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200",
                  !isDark
                    ? "bg-primary/15 border-primary/40 shadow-sm"
                    : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                )}
              >
                <span className="text-lg">☀️</span>
                <span className={cn("text-sm font-medium", !isDark ? "text-primary" : "text-foreground")}>
                  {t("settings.light")}
                </span>
                {!isDark && (
                  <svg className="ml-auto w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => { if (!isDark) handleThemeToggle(); }}
                className={cn(
                  "flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200",
                  isDark
                    ? "bg-primary/15 border-primary/40 shadow-sm"
                    : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                )}
              >
                <span className="text-lg">🌙</span>
                <span className={cn("text-sm font-medium", isDark ? "text-primary" : "text-foreground")}>
                  {t("settings.dark")}
                </span>
                {isDark && (
                  <svg className="ml-auto w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ── Accent Color ── */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
              {t("settings.accentColor")}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {ACCENT_PRESETS.map((preset) => {
                const isSelected = selectedAccent === preset.hue;
                return (
                  <button
                    key={preset.hue}
                    type="button"
                    onClick={() => handleAccentSelect(preset.hue)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all duration-200",
                      isSelected
                        ? "border-primary/50 bg-primary/10 shadow-sm scale-105"
                        : "border-border/50 bg-card/50 hover:bg-accent hover:border-foreground/20"
                    )}
                    style={{ minHeight: 72 }}
                  >
                    <div
                      className="w-6 h-6 rounded-full ring-1 ring-border/30 shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className={cn(
                      "text-[10px] font-medium leading-tight text-center",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}>
                      {t(preset.labelKey)}
                    </span>
                    {isSelected && (
                      <svg className="w-3 h-3 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {/* Spacer to keep height consistent when no checkmark */}
                    {!isSelected && <div className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
