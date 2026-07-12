import { useState, useEffect, useRef } from "react";
import { getAvatarUrl, getBodyUrl, preloadImage } from "@/lib/minecraft-avatar";

interface UseAvatarResult {
  /** Current avatar URL (default size 64) */
  avatarUrl: string;
  /** Full body render URL */
  bodyUrl: string;
  /** Whether the image is currently loading */
  loading: boolean;
  /** Whether the image failed to load */
  error: boolean;
  /** Force refresh the avatar */
  refresh: () => void;
}

/**
 * Hook for loading a Minecraft player's avatar with caching.
 * Automatically preloads the avatar and body images.
 * If the UUID is null/undefined, shows Steve fallback.
 */
export function useAvatar(uuid?: string | null): UseAvatarResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevUuidRef = useRef<string | null | undefined>(undefined);

  const avatarUrl = getAvatarUrl(uuid ?? undefined, 64);
  const bodyUrl = getBodyUrl(uuid ?? undefined);

  useEffect(() => {
    // Reset state when UUID changes
    if (uuid !== prevUuidRef.current) {
      setLoading(true);
      setError(false);
      prevUuidRef.current = uuid;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      try {
        // Preload both images in parallel
        await Promise.all([
          preloadImage(avatarUrl),
          preloadImage(bodyUrl),
        ]);
        if (!cancelled) {
          setLoading(false);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [uuid, avatarUrl, bodyUrl, refreshKey]);

  const refresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return {
    avatarUrl,
    bodyUrl,
    loading,
    error,
    refresh,
  };
}
