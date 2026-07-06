/** Response from starting a device code flow */
export interface DeviceCodeResponse {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

/** Result of polling for Microsoft token */
export interface TokenPollResult {
  status: "pending" | "success" | "expired" | "denied";
  accessToken?: string;
  refreshToken?: string;
  /** Error description if failed */
  error?: string;
}

/** Complete Minecraft session after successful auth */
export interface MinecraftSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  uuid: string;
  /** Xbox User ID (XUID) — potrzebny dla Minecraft 1.21+ */
  xuid?: string;
  expiresAt: string;
  /** If true, session is a mock/dev session without real Microsoft auth */
  offline?: boolean;
}

/** Auth state managed by useAuth hook */
export interface AuthState {
  session: MinecraftSession | null;
  loading: boolean;
  error: string | null;
}
