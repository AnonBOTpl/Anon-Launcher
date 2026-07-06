import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getJavaLabel } from "@/lib/java";
import type { JavaVersionInfo } from "@/lib/java";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JavaSettingsProps {
  versions: JavaVersionInfo[];
  value: string;
  onChange: (version: string) => void;
  customPath?: string;
  onCustomPathChange?: (path: string) => void;
  onDownload: (version: string) => void;
  isDownloading: boolean;
  downloadError?: string | null;
}

function JavaSettings({
  versions,
  value,
  onChange,
  customPath,
  onCustomPathChange,
  onDownload,
  isDownloading,
  downloadError,
}: JavaSettingsProps) {
  const [useCustom, setUseCustom] = useState(false);
  const [localCustomPath, setLocalCustomPath] = useState(customPath ?? "");
  const [verifiedVersion, setVerifiedVersion] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Find info about current version
  const currentJava = versions.find((v) => v.version === value);
  const isInstalled = currentJava?.installed && currentJava?.verified;
  const canDownload = versions.some((v) => v.version === value && v.available);

  const selectOptions = [
    { value: "8", label: "Java 8" },
    { value: "11", label: "Java 11" },
    { value: "17", label: "Java 17" },
    { value: "21", label: "Java 21" },
  ];

  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: "Wybierz javaw.exe",
        filters: [{ name: "Java", extensions: ["exe"] }],
      });
      if (selected && typeof selected === "string") {
        setLocalCustomPath(selected);
        onCustomPathChange?.(selected);
        setVerifying(true);
        setVerifyError(null);
        try {
          const ver = await invoke<string>("verify_java_path", { path: selected });
          setVerifiedVersion(ver);
        } catch (err) {
          const msg = typeof err === "string" ? err : "Nieprawidłowy plik Java";
          setVerifyError(msg);
          setVerifiedVersion(null);
        } finally {
          setVerifying(false);
        }
      }
    } catch {
      // Dialog not available
    }
  };

  return (
    <div className="space-y-2">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setUseCustom(false)}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            !useCustom
              ? "bg-purple-500/15 text-purple-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pobrana Java
        </button>
        <button
          type="button"
          onClick={() => setUseCustom(true)}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            useCustom
              ? "bg-purple-500/15 text-purple-400"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Własna ścieżka
        </button>
      </div>

      {/* Auto-download mode */}
      {!useCustom ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {selectOptions.map((opt) => {
                const installed = versions.some(
                  (v) => v.version === opt.value && v.installed && v.verified,
                );
                return (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}{installed ? " ✓" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {!isInstalled && !isDownloading && canDownload && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDownload(value)}
              className="h-10 shrink-0 text-xs px-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Pobierz
            </Button>
          )}

          {isDownloading && (
            <div className="flex items-center gap-1.5 h-10 shrink-0 px-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
              <span className="text-xs text-muted-foreground">Pobieranie...</span>
            </div>
          )}
        </div>
      ) : (
        /* Custom path */
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\javaw.exe"
                value={localCustomPath}
                onChange={(e) => {
                  setLocalCustomPath(e.target.value);
                  onCustomPathChange?.(e.target.value);
                  setVerifiedVersion(null);
                  setVerifyError(null);
                }}
                className="text-xs"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleBrowse} className="h-10 shrink-0 text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Przeglądaj
            </Button>
          </div>
          {verifying && <p className="text-xs text-muted-foreground">Weryfikacja...</p>}
          {verifiedVersion && <p className="text-xs text-emerald-400">✓ Wykryto {verifiedVersion}</p>}
          {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
        </div>
      )}

      {/* Warning */}
      {!useCustom && !isInstalled && !isDownloading && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
          <p className="text-xs text-amber-400">
            {getJavaLabel(value)} nie jest zainstalowana.
            {canDownload
              ? " Kliknij Pobierz, aby automatycznie ściągnąć."
              : " Wybierz inną wersję lub użyj własnej ścieżki."}
          </p>
        </div>
      )}

      {downloadError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5">
          <p className="text-xs text-destructive">{downloadError}</p>
        </div>
      )}
    </div>
  );
}

export default JavaSettings;
