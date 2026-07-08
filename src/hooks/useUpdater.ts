import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";

const GITHUB_API = "https://api.github.com/repos/AnonBOTpl/Anon-Launcher/releases/latest";
const RELEASES_URL = "https://github.com/AnonBOTpl/Anon-Launcher/releases/latest";

export interface UpdateInfo {
  version: string;
  releaseUrl: string;
  body: string;
}

export function useUpdater() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  async function checkForUpdates() {
    try {
      const currentVersion = await getVersion();

      const resp = await fetch(GITHUB_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!resp.ok) return;

      const release = await resp.json();
      const latestVersion = (release.tag_name as string).replace(/^v/, "");
      const releaseUrl = release.html_url as string;
      const body = (release.body as string) ?? "";

      if (isNewerVersion(latestVersion, currentVersion)) {
        setUpdate({ version: latestVersion, releaseUrl, body });
      }
    } catch {
      // Brak internetu lub błąd API — cicho ignoruj
    }
  }

  function openRelease() {
    open(update?.releaseUrl ?? RELEASES_URL);
  }

  return { update, openRelease };
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.split(".").map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [lMaj, lMin, lPat] = parse(latest);
  const [cMaj, cMin, cPat] = parse(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}
