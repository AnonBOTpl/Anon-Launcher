import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { AVAILABLE_LOCALES } from "@/lib/i18n";
import { ACCENT_PRESETS, getAccentHue, setAccentHue, applyAccentHue } from "@/lib/accents";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { saveAccount } from "@/lib/accounts";
import { cn } from "@/lib/utils";

interface FirstRunWizardProps {
  onComplete: () => void;
}

type Step = "language" | "theme" | "account";

function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const { t, i18n } = useTranslation();
  const { startLogin, flowState, cancelLogin } = useAuth();
  const { accounts, refresh: refreshAccounts, switchAccount } = useAccounts();
  const [step, setStep] = useState<Step>("language");
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState(i18n.language);
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  const steps: Step[] = ["language", "theme", "account"];

  // Load app icon
  useEffect(() => {
    invoke<string>("read_app_icon")
      .then(setAppIcon)
      .catch(() => setAppIcon(null));
  }, []);

  const goForward = useCallback(() => {
    const idx = steps.indexOf(step);
    if (idx >= 0 && idx < steps.length - 1) {
      const next = steps[idx + 1];
      if (next) {
        setDirection("forward");
        setStep(next);
      }
    }
  }, [step, steps]);

  const goBack = useCallback(() => {
    const idx = steps.indexOf(step);
    if (idx > 0) {
      const prev = steps[idx - 1];
      if (prev) {
        setDirection("backward");
        setStep(prev);
      }
    }
  }, [step, steps]);

  const handleLanguageSelect = useCallback((code: string) => {
    setSelectedLang(code);
    i18n.changeLanguage(code);
  }, [i18n]);

  const handleThemeToggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      applyAccentHue(getAccentHue());
      return next;
    });
  }, []);

  const handleFinish = useCallback(() => {
    localStorage.setItem("anon_first_run_done", "true");
    onComplete();
  }, [onComplete]);

  const handleAddAccount = useCallback(() => {
    startLogin();
  }, [startLogin]);

  const handleSkipAccount = useCallback(() => {
    cancelLogin();
    handleFinish();
  }, [cancelLogin, handleFinish]);

  const isLoginLoading = flowState.step === "polling" || flowState.step === "completing";
  const isLoginError = flowState.step === "error";

  // Save account after successful login, then refresh the accounts list
  useEffect(() => {
    if (flowState.step === "done" && flowState.session) {
      saveAccount(flowState.session).catch(() => {}).finally(() => {
        refreshAccounts();
      });
    }
  }, [flowState.step, flowState.session, refreshAccounts]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop blur overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Wizard card */}
      <div className="relative w-full max-w-lg mx-4">
        <div className="glass rounded-2xl p-8 sm:p-10 shadow-2xl shadow-primary/10 border border-border/60 overflow-hidden">
          {/* Decorative top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0" />

          {/* Logo — small, top */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-portal-pulse" />
              <div className="relative w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                {appIcon ? (
                  <img
                    src={appIcon}
                    alt="AnonLauncher"
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <span className="text-xl font-bold text-white">A</span>
                )}
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((s, i) => {
              const isActive = step === s;
              const isPast = steps.indexOf(s) < steps.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <div
                      className={cn(
                        "w-8 h-px transition-colors duration-500",
                        isPast || isActive ? "bg-primary/50" : "bg-border"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all duration-500 border",
                      isActive
                        ? "bg-primary/20 border-primary text-primary scale-110"
                        : isPast
                        ? "bg-primary/10 border-primary/30 text-primary/70"
                        : "bg-card border-border text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div className="relative min-h-[360px]">
            {/* ── Step 1: Language ── */}
            <div
              className={cn(
                "transition-all duration-500 ease-out",
                step === "language"
                  ? "opacity-100 translate-x-0"
                  : direction === "forward"
                  ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none"
                  : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"
              )}
            >
              <div className="flex flex-col items-center text-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                  🌐
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground">
                    {t("wizard.language")}
                  </h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line max-w-xs">
                    {t("wizard.languageDesc")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-1">
                  {AVAILABLE_LOCALES.map((locale) => (
                    <button
                      key={locale.code}
                      onClick={() => handleLanguageSelect(locale.code)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border",
                        selectedLang === locale.code
                          ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                          : "bg-card/50 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:border-foreground/20"
                      )}
                    >
                      <span className="text-base">{locale.flag}</span>
                      <span>{locale.label}</span>
                      {selectedLang === locale.code && (
                        <svg
                          className="ml-auto w-4 h-4 text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={goForward}
                  className="mt-1 px-8 py-2.5 rounded-xl bg-gradient-to-r from-primary/80 to-primary text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary/80 active:scale-[0.97] transition-all duration-200"
                >
                  {t("wizard.next")}
                </button>
              </div>
            </div>

            {/* ── Step 2: Theme ── */}
            <div
              className={cn(
                "transition-all duration-500 ease-out",
                step === "theme"
                  ? "opacity-100 translate-x-0"
                  : direction === "forward"
                  ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none"
                  : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"
              )}
            >
              <div className="flex flex-col items-center text-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                  🎨
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground">
                    {t("wizard.theme")}
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    {t("wizard.themeDesc")}
                  </p>
                </div>

                {/* Theme cards */}
                <div className="flex gap-3 w-full max-w-xs">
                  <button
                    onClick={() => { if (!isDark) handleThemeToggle(); }}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                      isDark
                        ? "bg-primary/15 border-primary/40 shadow-sm"
                        : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-lg">
                      🌙
                    </div>
                    <span className={cn("text-sm font-medium", isDark ? "text-primary" : "text-muted-foreground")}>
                      {t("settings.dark")}
                    </span>
                    {isDark && (
                      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => { if (isDark) handleThemeToggle(); }}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200",
                      !isDark
                        ? "bg-primary/15 border-primary/40 shadow-sm"
                        : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                    )}
                  >
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-lg">
                      ☀️
                    </div>
                    <span className={cn("text-sm font-medium", !isDark ? "text-primary" : "text-muted-foreground")}>
                      {t("settings.light")}
                    </span>
                    {!isDark && (
                      <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Accent color picker */}
                <div className="w-full max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground font-medium">
                      {t("wizard.accent")}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {ACCENT_PRESETS.map((preset) => {
                      const isSelected = getAccentHue() === preset.hue;
                      return (
                        <button
                          key={preset.hue}
                          type="button"
                          onClick={() => setAccentHue(preset.hue)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all duration-200",
                            isSelected
                              ? "border-primary/50 bg-primary/10 shadow-sm scale-105"
                              : "border-border/50 bg-card/50 hover:bg-accent hover:border-foreground/20"
                          )}
                          style={{ minHeight: 68 }}
                        >
                          <div
                            className="w-5 h-5 rounded-full ring-1 ring-border/30 shrink-0"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span className={cn(
                            "text-[9px] font-medium leading-tight text-center",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}>
                            {t(preset.labelKey)}
                          </span>
                          {isSelected && (
                            <svg className="w-3 h-3 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {!isSelected && <div className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-3 mt-1 w-full max-w-xs">
                  <button
                    onClick={goBack}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                  >
                    {t("common.back")}
                  </button>
                  <button
                    onClick={goForward}
                    className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-primary/80 to-primary text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary/80 active:scale-[0.97] transition-all duration-200"
                  >
                    {t("wizard.next")}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Step 3: Account ── */}
            <div
              className={cn(
                "transition-all duration-500 ease-out",
                step === "account"
                  ? "opacity-100 translate-x-0"
                  : direction === "forward"
                  ? "opacity-0 -translate-x-8 absolute inset-0 pointer-events-none"
                  : "opacity-0 translate-x-8 absolute inset-0 pointer-events-none"
              )}
            >
              <div className="flex flex-col items-center text-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                  🔐
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-foreground">
                    {t("wizard.account")}
                  </h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-line max-w-xs">
                    {t("wizard.accountDesc")}
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
                  {/* Account list — shows all saved accounts */}
                  {accounts.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.uuid}
                          type="button"
                          onClick={() => switchAccount(acc.uuid)}
                          className={cn(
                            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all duration-200",
                            acc.isActive
                              ? "bg-emerald-500/10 border-emerald-500/20"
                              : "bg-card/50 border-border/50 hover:bg-accent hover:border-foreground/20"
                          )}
                        >
                          <span className="text-base">
                            {acc.isActive ? "✅" : "🔵"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              acc.isActive ? "text-emerald-400" : "text-foreground"
                            )}>
                              {acc.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {acc.isActive ? t("wizard.sessionActive") : t("wizard.switchTo")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Login button — always visible, allows adding another account */}
                  <button
                    onClick={handleAddAccount}
                    disabled={isLoginLoading}
                    className={cn(
                      "w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200",
                      isLoginLoading
                        ? "bg-primary/20 text-primary/70 cursor-wait"
                        : "bg-gradient-to-r from-primary/80 to-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary/80 active:scale-[0.97]"
                    )}
                  >
                    {isLoginLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {flowState.step === "polling" ? t("accounts.refresh") : t("common.loading")}
                      </span>
                    ) : (
                      t("wizard.accountAction")
                    )}
                  </button>

                  {/* Error message */}
                  {isLoginError && (
                    <p className="text-xs text-destructive">{flowState.error}</p>
                  )}

                  {/* Skip — always visible */}
                  <button
                    onClick={handleSkipAccount}
                    disabled={isLoginLoading}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {t("wizard.accountSkip")}
                  </button>
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-3 mt-1 w-full max-w-xs">
                  <button
                    onClick={goBack}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                  >
                    {t("common.back")}
                  </button>
                  <button
                    onClick={handleFinish}
                    className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-primary/80 to-primary text-white font-medium text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary/80 active:scale-[0.97] transition-all duration-200"
                  >
                    {t("wizard.finish")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step counter */}
          <div className="mt-5 text-center">
            <span className="text-xs text-muted-foreground">
              {t("wizard.step")} {steps.indexOf(step) + 1} {t("wizard.of")} 3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FirstRunWizard;
