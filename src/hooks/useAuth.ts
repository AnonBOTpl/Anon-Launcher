import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { completeMinecraftAuth } from "@/lib/auth";
import { tryRefreshSession, clearAccountSession } from "@/lib/accounts";
import type {
  DeviceCodeResponse,
  TokenPollResult,
  MinecraftSession,
  AuthState,
} from "@/types/auth";

interface AuthCodeFlowInfo {
  url: string;
  port: number;
  codeVerifier: string;
}

interface DeviceCodeFlowState {
  step: "idle" | "code" | "polling" | "completing" | "done" | "error";
  deviceCode: DeviceCodeResponse | null;
  authCodeFlow: AuthCodeFlowInfo | null;
  error: string | null;
  session: MinecraftSession | null;
}

export function useAuth(): AuthState & {
  startLogin: () => void;
  cancelLogin: () => void;
  logout: () => void;
  flowState: DeviceCodeFlowState;
} {
  const [flowState, setFlowState] = useState<DeviceCodeFlowState>({
    step: "idle",
    deviceCode: null,
    authCodeFlow: null,
    error: null,
    session: null,
  });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portRef = useRef<number | null>(null);

  // Auto-restore session on mount
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const session = await tryRefreshSession();
      if (!cancelled && session) {
        setFlowState({
          step: "done",
          deviceCode: null,
          authCodeFlow: null,
          error: null,
          session: {
            accessToken: session.accessToken,
            refreshToken: "",
            username: session.username,
            uuid: session.uuid,
            expiresAt: session.expiresAt,
          },
        });
      }
    }

    restore();

    return () => { cancelled = true; };
  }, []);

  // Clear polling
  const clearPoll = useCallback(() => {
    if (pollRef.current !== null) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cancel login
  const cancelLogin = useCallback(() => {
    clearPoll();
    portRef.current = null;
    setFlowState({
      step: "idle",
      deviceCode: null,
      authCodeFlow: null,
      error: null,
      session: null,
    });
  }, [clearPoll]);

  // Poll for auth code callback (PKCE flow)
  const pollAuthCodeCallback = useCallback(
    async (port: number, codeVerifier: string) => {
      try {
        // Check if we received the callback
        const code = await invoke<string | null>("poll_auth_code_callback");

        if (code) {
          // Got the authorization code — exchange it for tokens
          setFlowState((prev) => ({ ...prev, step: "completing", deviceCode: null }));

          const result: TokenPollResult = await invoke<TokenPollResult>("exchange_auth_code", {
            code,
            codeVerifier,
            redirectPort: port,
          });

          if (result.status === "success" && result.accessToken) {
            // Complete Minecraft auth chain
            const session: MinecraftSession = await completeMinecraftAuth(
              result.accessToken!
            );

            // Copy refresh token from exchange result
            if (result.refreshToken) {
              session.refreshToken = result.refreshToken;
            }

            setFlowState({
              step: "done",
              deviceCode: null,
              authCodeFlow: null,
              error: null,
              session,
            });
            return;
          }

          setFlowState((prev) => ({
            ...prev,
            step: "error",
            error: result.error || "Wymiana kodu nie powiodła się",
          }));
          return;
        }

        // No callback yet — poll again after 2 seconds
        pollRef.current = setTimeout(
          () => pollAuthCodeCallback(port, codeVerifier),
          2000
        );
      } catch (err) {
        const message = typeof err === "string" ? err : err instanceof Error ? err.message : "Logowanie przez przeglądarkę nie powiodło się";
        console.error("Auth code callback poll error:", err);
        setFlowState((prev) => ({
          ...prev,
          step: "error",
          error: message,
        }));
      }
    },
    []
  );

  // Start login — uses Authorization Code Flow (PKCE)
  const startLogin = useCallback(async () => {
    clearPoll();
    portRef.current = null;
    setFlowState({
      step: "code",
      deviceCode: null,
      authCodeFlow: null,
      error: null,
      session: null,
    });

    try {
      // Use Authorization Code Flow with PKCE
      const result = await invoke<AuthCodeFlowInfo>("start_auth_code_flow");

      portRef.current = result.port;

      setFlowState({
        step: "polling",
        deviceCode: null,
        authCodeFlow: result,
        error: null,
        session: null,
      });

      // Open the system browser to the Microsoft login URL
      try {
        // Use Tauri's shell API to open the URL in the default browser
        const { open } = await import("@tauri-apps/plugin-shell");
        open(result.url);
      } catch {
        // Fallback: try window.open (might work in dev mode)
        window.open(result.url, "_blank");
      }

      // Start polling for the callback
      pollAuthCodeCallback(result.port, result.codeVerifier);
    } catch (err) {
      const message = typeof err === "string" ? err : err instanceof Error ? err.message : "Nie udało się rozpocząć logowania";
      console.error("start_auth_code_flow error:", err);
      setFlowState((prev) => ({
        ...prev,
        step: "error",
        error: message,
      }));
    }
  }, [clearPoll, pollAuthCodeCallback]);

  // Logout
  const logout = useCallback(() => {
    clearPoll();
    portRef.current = null;
    // Clear persistent session data (localStorage + backend)
    clearAccountSession();
    setFlowState({
      step: "idle",
      deviceCode: null,
      authCodeFlow: null,
      error: null,
      session: null,
    });
  }, [clearPoll]);

  return {
    session: flowState.session,
    loading: flowState.step === "polling" || flowState.step === "completing",
    error: flowState.error,
    startLogin,
    cancelLogin,
    logout,
    flowState,
  };
}
