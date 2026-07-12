import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { AVAILABLE_LOCALES } from "@/lib/i18n";
import { ACCENT_PRESETS, getAccentHue, setAccentHue, applyAccentHue } from "@/lib/accents";
import { useJavaRuntime } from "@/hooks/useJavaRuntime";
import { getJavaLabel } from "@/lib/java";
import { cn } from "@/lib/utils";

const GITHUB_API = "https://api.github.com/repos/AnonBOTpl/Anon-Launcher/releases/latest";
const RELEASES_URL = "https://github.com/AnonBOTpl/Anon-Launcher/releases/latest";

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedAccent, setSelectedAccent] = useState(getAccentHue());
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // App version
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("?"));
  }, []);

  // Java runtime
  const {
    versions: javaVersions,
    downloading,
    downloadStatus,
    startDownload,
  } = useJavaRuntime();

  // Update checking
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const resp = await fetch(GITHUB_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) {
        setUpdateError(t("settingsPage.updateCheckError"));
        return;
      }
      const release = await resp.json();
      const latest = (release.tag_name as string).replace(/^v/, "");
      setLatestVersion(latest);

      if (appVersion) {
        const isNewer = () => {
          const parse = (v: string): [number, number, number] => {
            const parts = v.split(".").map(Number);
            return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
          };
          const [lMaj, lMin, lPat] = parse(latest);
          const [cMaj, cMin, cPat] = parse(appVersion);
          if (lMaj !== cMaj) return lMaj > cMaj;
          if (lMin !== cMin) return lMin > cMin;
          return lPat > cPat;
        };
        setUpdateAvailable(isNewer());
      }
    } catch {
      setUpdateError(t("settingsPage.updateNetworkError"));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const openReleases = () => {
    open(updateAvailable ? latestVersion ? `https://github.com/AnonBOTpl/Anon-Launcher/releases/tag/v${latestVersion}` : RELEASES_URL : RELEASES_URL);
  };

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
    <div className="min-h-full animate-page-enter">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
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
              <path d="m15 18-6-6 6-6" />
            </svg>
            {t("common.back")}
          </button>
          <h1 className="text-xl font-bold tracking-tight">{t("settingsPage.title")}</h1>
        </div>
      </div>

      {/* Content — fills entire window */}
      <div className="px-8 pt-6 pb-12">
        <div className="space-y-8">
          {/* ── Language section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.languageSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                    🌐
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("settings.language")}</p>
                    <p className="text-xs text-muted-foreground">{t("settings.description")}</p>
                  </div>
                </div>
                <select
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-ring shrink-0"
                >
                  {AVAILABLE_LOCALES.map((locale) => (
                    <option key={locale.code} value={locale.code}>
                      {locale.flag} {locale.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Theme section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.themeSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { if (isDark) handleThemeToggle(); }}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200",
                    !isDark
                      ? "bg-primary/15 border-primary/40 shadow-sm"
                      : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                  )}
                >
                  <span className="text-lg">☀️</span>
                  <div className="flex-1 text-left">
                    <span className={cn("text-sm font-medium", !isDark ? "text-primary" : "text-foreground")}>
                      {t("settings.light")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">Light mode</p>
                  </div>
                  {!isDark && (
                    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { if (!isDark) handleThemeToggle(); }}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200",
                    isDark
                      ? "bg-primary/15 border-primary/40 shadow-sm"
                      : "bg-card/50 border-border hover:bg-accent hover:border-foreground/20"
                  )}
                >
                  <span className="text-lg">🌙</span>
                  <div className="flex-1 text-left">
                    <span className={cn("text-sm font-medium", isDark ? "text-primary" : "text-foreground")}>
                      {t("settings.dark")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">Dark mode</p>
                  </div>
                  {isDark && (
                    <svg className="w-4 h-4 text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* ── Accent Color section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.accentSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {ACCENT_PRESETS.map((preset) => {
                  const isSelected = selectedAccent === preset.hue;
                  return (
                    <button
                      key={preset.hue}
                      type="button"
                      onClick={() => handleAccentSelect(preset.hue)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg border transition-all duration-200",
                        isSelected
                          ? "border-primary/50 bg-primary/10 shadow-sm scale-105"
                          : "border-border/50 bg-card/50 hover:bg-accent hover:border-foreground/20"
                      )}
                      style={{ minHeight: 64 }}
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
                      {!isSelected && <div className="w-3 h-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Java Manager section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.javaSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 space-y-4">
              <p className="text-xs text-muted-foreground">{t("settingsPage.javaDesc")}</p>

              {javaVersions.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                  {t("common.loading")}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
                  {javaVersions.map((jv) => {
                    const isDownloading = downloading === jv.version;
                    const installed = jv.installed && jv.verified;
                    const isCurrentDownloadTarget = downloadStatus && downloadStatus.version === jv.version && !downloadStatus.success;
                    return (
                      <div
                        key={jv.version}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-background/40 px-4 py-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                              installed
                                ? "bg-emerald-500/15 text-emerald-500"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {jv.version}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {getJavaLabel(jv.version)}
                            </p>
                            <p className={cn(
                              "text-xs",
                              installed ? "text-emerald-500" : "text-muted-foreground"
                            )}>
                              {installed
                                ? t("java.installed")
                                : jv.available
                                  ? t("java.notInstalled", { label: getJavaLabel(jv.version) })
                                  : t("java.unavailable")
                              }
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {installed ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                              </svg>
                              {t("java.downloaded")}
                            </div>
                          ) : isDownloading || isCurrentDownloadTarget ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-primary" />
                              {t("java.downloading")}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startDownload(jv.version)}
                              disabled={!jv.available}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                jv.available
                                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                                  : "bg-muted text-muted-foreground/50 cursor-not-allowed"
                              )}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              {t("java.download")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Download error */}
              {downloadStatus && !downloadStatus.success && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {downloadStatus.error}
                </div>
              )}
            </div>
          </section>

          {/* ── Updates section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.updatesSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("settingsPage.updatesTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {appVersion
                        ? t("settingsPage.currentVersion", { version: appVersion })
                        : t("common.loading")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={checkForUpdates}
                  disabled={checkingUpdate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {checkingUpdate ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      {t("settingsPage.checkingUpdates")}
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10" /><polyline points="23 4 13.5 14 9.5 9.5 1 18" />
                      </svg>
                      {t("settingsPage.checkUpdates")}
                    </>
                  )}
                </button>
              </div>

              {/* Update result */}
              {updateError && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {updateError}
                </div>
              )}

              {!checkingUpdate && latestVersion && (
                <div className={cn(
                  "rounded-lg border p-3 text-sm",
                  updateAvailable
                    ? "border-primary/50 bg-primary/10"
                    : "border-emerald-500/30 bg-emerald-500/10"
                )}>
                  {updateAvailable ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                        </svg>
                        <span className="text-foreground">
                          {t("update.available")}: v{latestVersion}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={openReleases}
                        className="text-primary hover:text-primary font-medium underline underline-offset-2 transition-colors text-xs shrink-0"
                      >
                        {t("update.download")}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {t("settingsPage.upToDate")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── About section ── */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/60 mb-3">
              {t("settingsPage.aboutSection")}
            </h2>
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                    <path d="M12 10v4" /><path d="M12 18h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">AnonLauncher</p>
                  <p className="text-xs text-muted-foreground">
                    {appVersion
                      ? t("settingsPage.currentVersion", { version: appVersion })
                      : t("common.loading")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => open("https://github.com/AnonBOTpl/Anon-Launcher")}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
                <button
                  type="button"
                  onClick={() => open(RELEASES_URL)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                  </svg>
                  {t("settingsPage.releases")}
                </button>
              </div>

              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                AnonLauncher — Tauri + React + TypeScript
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
