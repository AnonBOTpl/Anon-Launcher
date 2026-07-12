import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";

export function Titlebar() {
  const win = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    win.isMaximized().then(setIsMaximized);
    const unlisten = win.onResized(async () => {
      setIsMaximized(await win.isMaximized());
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-between
                 bg-background/80 backdrop-blur-sm border-b border-border/40
                 px-3 select-none"
    >
      {/* Lewa strona — logo / nazwa */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 pointer-events-none"
      >
        <img src="/icon.png" alt="" className="h-4 w-4 opacity-70" />
        <span className="text-xs font-medium text-muted-foreground">
          AnonLauncher
        </span>
      </div>

      {/* Prawa strona — przyciski sterowania */}
      <div className="flex items-center">
        {/* Minimalizuj */}
        <button
          onClick={() => win.minimize()}
          className="flex h-9 w-11 items-center justify-center
                     text-muted-foreground hover:bg-accent
                     hover:text-foreground transition-colors"
        >
          <svg width="11" height="1" viewBox="0 0 11 1" fill="currentColor">
            <rect width="11" height="1" />
          </svg>
        </button>

        {/* Maksymalizuj / Przywróć */}
        <button
          onClick={async () => {
            if (await win.isMaximized()) {
              win.unmaximize();
            } else {
              win.maximize();
            }
          }}
          className="flex h-9 w-11 items-center justify-center
                     text-muted-foreground hover:bg-accent
                     hover:text-foreground transition-colors"
        >
          {isMaximized ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="3" y="0" width="8" height="8" />
              <polyline points="0,3 0,11 8,11 8,8" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 11 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="0.5" y="0.5" width="10" height="10" />
            </svg>
          )}
        </button>

        {/* Zamknij */}
        <button
          onClick={() => win.close()}
          className="flex h-9 w-11 items-center justify-center
                     text-muted-foreground hover:bg-destructive
                     hover:text-white transition-colors rounded-tr-xl"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 11 11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <line x1="0" y1="0" x2="11" y2="11" />
            <line x1="11" y1="0" x2="0" y2="11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
