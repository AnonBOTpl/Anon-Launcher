import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAvatar } from "@/hooks/useAvatar";

interface AvatarRendererProps {
  /** Player UUID */
  uuid?: string | null;
  /** Size of the avatar (default 64) */
  size?: number;
  /** Whether to show full body (default true) */
  showBody?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Renders a Minecraft player's 2D skin.
 * Shows head avatar + optional full body render.
 * Falls back to Steve if no UUID provided or on error.
 */
function AvatarRenderer({ uuid, size = 64, showBody = true, className }: AvatarRendererProps) {
  const { t } = useTranslation();
  const { avatarUrl, bodyUrl, loading, error } = useAvatar(uuid);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Avatar (head) */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
          </div>
        )}
        <img
          src={error ? undefined : avatarUrl}
          alt="Player avatar"
          width={size}
          height={size}
          className={cn(
            "rounded-xl object-cover ring-2 ring-border/50",
            loading && "opacity-30",
          )}
          onError={(e) => {
            // Fallback to Steve on error
            (e.target as HTMLImageElement).src = `https://mc-heads.net/avatar/steve/${size}`;
          }}
        />
      </div>

      {/* Full body render */}
      {showBody && (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-purple-500" />
            </div>
          )}
          <img
            src={error ? undefined : bodyUrl}
            alt="Player skin"
            className={cn(
              "h-32 w-auto object-contain",
              loading && "opacity-30",
            )}
            onError={(e) => {
              // Fallback to Steve body on error
              (e.target as HTMLImageElement).src = "https://mc-heads.net/body/steve";
            }}
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 ring-1 ring-border/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 1 0-16 0" />
            </svg>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("common.fallback")}</p>
        </div>
      )}
    </div>
  );
}

export default AvatarRenderer;
