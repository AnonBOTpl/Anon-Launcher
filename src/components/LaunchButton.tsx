import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LaunchButtonProps {
  /** Current launch status */
  status:
    | { type: "idle" }
    | { type: "launching" }
    | { type: "running"; pid: number }
    | { type: "error"; message: string }
    | { type: "stopped"; exitCode: number | null };
  /** Called when the user clicks launch */
  onLaunch: () => void;
  /** Called when the user clicks stop */
  onStop: () => void;
  /** Whether the instance can be launched (e.g. Java available, logged in) */
  canLaunch?: boolean;
  /** Optional reason why launch is disabled */
  disabledReason?: string;
  /** Button size variant */
  size?: "default" | "hero";
}

export function LaunchButton({
  status,
  onLaunch,
  onStop,
  canLaunch = true,
  disabledReason,
  size = "default",
}: LaunchButtonProps) {
  const { t } = useTranslation();
  const isHero = size === "hero";

  switch (status.type) {
    case "idle":
    case "stopped":
      return (
        <button
          onClick={onLaunch}
          disabled={!canLaunch}
          title={disabledReason}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-xl font-semibold text-white shadow-lg transition-all duration-200 active:scale-[0.97]",
            canLaunch
              ? "bg-gradient-to-r from-primary to-primary/80 shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary"
              : "bg-muted text-muted-foreground cursor-not-allowed shadow-none",
            isHero ? "h-11 px-6 text-sm" : "h-9 px-4 text-xs",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={isHero ? 18 : 14}
            height={isHero ? 18 : 14}
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          {t("instance.launch")}
        </button>
      );

    case "launching":
      return (
        <button
          disabled
          className={cn(
            "inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-primary/50 to-primary/50 font-semibold text-white/70 cursor-wait animate-launch-pulse",
            isHero ? "h-11 px-6 text-sm" : "h-9 px-4 text-xs",
          )}
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {t("instance.launching")}
        </button>
      );

    case "running":
      return (
        <button
          onClick={onStop}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 active:scale-[0.97]",
            "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-red-500/25 hover:shadow-red-500/40 hover:from-red-500 hover:to-red-400",
            isHero ? "h-11 px-6 text-sm" : "h-9 px-4 text-xs",
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={isHero ? 18 : 14}
            height={isHero ? 18 : 14}
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          {t("instance.stop")}
        </button>
      );

    case "error":
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={onLaunch}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-xl font-semibold shadow-lg transition-all duration-200 active:scale-[0.97]",
              "bg-gradient-to-r from-primary to-primary/80 text-white shadow-primary/25 hover:shadow-primary/40 hover:from-primary/80 hover:to-primary",
              isHero ? "h-11 px-6 text-sm" : "h-9 px-4 text-xs",
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={isHero ? 18 : 14}
              height={isHero ? 18 : 14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            {t("launch.retry")}
          </button>
          {!isHero && (
            <span className="text-xs text-destructive max-w-[200px] truncate">
              {status.message}
            </span>
          )}
        </div>
      );
  }
}
