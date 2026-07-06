/** Account metadata returned from backend listing (no sensitive tokens) */
export interface AccountMeta {
  uuid: string;
  username: string;
  last_used: string;
  offline: boolean;
}

/** Full account data used for saving */
export interface AccountData {
  uuid: string;
  username: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  lastUsed: string;
  offline: boolean;
}

/** Minimal info needed to display in the switcher */
export interface AccountDisplay {
  uuid: string;
  username: string;
  lastUsed: string;
  offline: boolean;
  isActive: boolean;
}
