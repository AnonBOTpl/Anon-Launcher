/**
 * Authentication library — deleguje do backendu Tauri.
 */

import { invoke } from "@tauri-apps/api/core";
import type { MinecraftSession } from "@/types/auth";

/**
 * Complete the Minecraft auth chain (XBL → XSTS → Minecraft → Profile).
 */
export async function completeMinecraftAuth(
  msAccessToken: string,
): Promise<MinecraftSession> {
  return invoke<MinecraftSession>("complete_minecraft_auth", { msAccessToken });
}
