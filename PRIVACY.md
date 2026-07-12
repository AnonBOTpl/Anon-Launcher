# Privacy Policy — AnonLauncher

**Last updated:** July 10, 2026

## 1. What We Collect

AnonLauncher collects and stores the following data locally on your device:

| Data | Purpose | Storage |
|------|---------|---------|
| Microsoft account identifier | Session identification during OAuth flow | Not stored locally |
| Minecraft UUID | Session identification, instance management | Local encrypted vault |
| Minecraft username | UI display, game profile | Local encrypted vault |
| Access token (temporary) | Minecraft authentication — expires after ~24h | Local file (OS-protected) |
| Refresh token | Silent re-authentication without re-login | Local encrypted vault (Stronghold) |

## 2. How We Use It

- **Authentication:** All collected data is used exclusively to authenticate you with Microsoft and Mojang (Minecraft) services so you can play the game.
- **No telemetry:** AnonLauncher does **not** collect usage statistics, crash reports, analytics, or any other telemetry data.
- **No tracking:** There are no trackers, cookies, or analytics SDKs embedded in the application.

## 3. Data Sharing

AnonLauncher **does not** share, sell, or transmit your personal data to any third party — with one necessary exception:

- **Microsoft / Mojang:** Your access token and refresh token are sent to Microsoft's and Mojang's authentication endpoints (`login.live.com`, `api.minecraftservices.com`, etc.) as part of the standard Minecraft authentication flow. This is required to play the game.

## 4. Data Storage

- All sensitive data (tokens, credentials) is stored **locally** on your machine in an encrypted Stronghold vault using Argon2 key derivation.
- No data is sent to any AnonLauncher-operated server — because there are none.
- If you delete an instance or remove your account, the associated data is permanently deleted from your device.

## 5. Your Rights

Since all data is stored locally and no data leaves your device except for the standard Microsoft/Mojang auth flow, you have full control:

- **Delete your data:** Remove your account from the launcher's Settings → Accounts panel.
- **Revoke access:** Go to your [Microsoft Account](https://account.microsoft.com/account) → Security → App permissions and revoke AnonLauncher's access.
- **Full deletion:** Uninstalling AnonLauncher and deleting its data folder (`%APPDATA%/com.anonlauncher.app`) removes all locally stored data.

## 6. Third-Party Services

AnonLauncher communicates with the following external APIs solely for functionality purposes:

| Service | Purpose | Data Sent |
|---------|---------|-----------|
| `login.live.com` (Microsoft) | OAuth2 authentication | Device code, token exchange |
| `api.minecraftservices.com` (Mojang) | Minecraft profile & auth | Access token, UUID |
| `api.modrinth.com` (Modrinth) | Mod/resource/shader/modpack search & download | Search queries, version metadata |
| `piston-meta.mojang.com` (Mojang) | Minecraft version manifests | None (public data) |
| `api.github.com` (GitHub) | Update checking | None (public data) |

## 7. Changes to This Policy

If this policy changes, the version date at the top will be updated. Since the launcher checks for updates via GitHub, you'll be notified of new versions.

## 8. Contact

For questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/AnonBOTpl/Anon-Launcher).

---

**AnonLauncher** is not affiliated with Mojang AB, Microsoft Corp., or Modrinth.
