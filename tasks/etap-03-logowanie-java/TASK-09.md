# TASK-09 — Microsoft Device Code Flow

## Cel
Implementacja logowania przez konto Microsoft przy użyciu Device Code Flow (biblioteka `@xmcl/minecraft-java-core`), umożliwiająca uwierzytelnienie gracza i uzyskanie tokenów dostępu do Minecraft.

## Warstwa
Obie (Frontend + Backend) — Node.js sidecar wymagany

## Pliki do utworzenia / modyfikacji
- `src/lib/auth.ts` — główny moduł autoryzacji
- `src/hooks/useAuth.ts`
- `src/components/LoginDialog.tsx`
- `src/components/DeviceCodeDisplay.tsx`

## Zależności
TASK-01

## Szczegóły implementacji
0. Konfiguracja sidecar: minecraft-java-core jest biblioteką Node.js i nie działa
   w kontekście przeglądarkowym Tauri. Musi być uruchomiona jako sidecar (osobny
   proces Node.js) zarządzany przez `tauri-plugin-shell`. Skonfiguruj sidecar
   w `tauri.conf.json` (`sidecar: true`) i dodaj binarny bundle Node.js do
   `src-tauri/binaries/`. Komunikacja frontend ↔ sidecar odbywa się przez
   Tauri Events lub stdin/stdout.
1. Użyj `@xmcl/minecraft-java-core` (`microsoftDeviceCodeLogin` lub odpowiednik) do implementacji Device Code Flow.
2. Flow: kliknij "Zaloguj przez Microsoft" → wywołaj API Microsoft → otrzymaj `user_code`, `device_code`, `verification_uri` → wyświetl kod użytkownikowi z instrukcją → polluj o token co kilka sekund → po autoryzacji odbierz refresh token i access token.
3. UI: `DeviceCodeDisplay` — wyświetla kod w dużym, czytelnym formacie, instrukcję "Otwórz stronę <verification_uri> i wpisz kod: <user_code>", przycisk "Otwórz stronę" który otwiera URL w przeglądarce.
4. `LoginDialog` — modal z przyciskiem "Zaloguj przez Microsoft", wyświetleniem kodu, stanami ładowania/błędu.
5. Po uzyskaniu tokenów: extracts `username` (gamertag), `uuid`, `xuid` z profilu Minecraft.
6. Zwróć obiekt sesji: `{ accessToken, refreshToken, expiresAt, username, uuid }`.

## Definition of Done
- Kliknięcie "Zaloguj przez Microsoft" inicjuje Device Code Flow.
- Kod jest wyświetlany użytkownikowi z instrukcją.
- Po autoryzacji w przeglądarce, launcher odbiera tokeny.
- Obiekt sesji zawiera nazwę użytkownika, UUID i tokeny.
- Błędy autoryzacji (timeout, odrzucone przez użytkownika) są obsłużone.
