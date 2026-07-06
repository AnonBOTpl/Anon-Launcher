# TASK-27 — Avatar 2D w zakładce Profil

## Cel
Implementacja zakładki Profil w widoku instancji z wyświetlaniem awatara Minecraft (skin) w formacie 2D flat (canvas/img) oraz informacji o koncie Microsoft.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/components/AvatarRenderer.tsx` — renderowanie awatara 2D
- `src/components/ProfileTab.tsx` — zakładka profilu
- `src/hooks/useAvatar.ts`
- `src/lib/minecraft-avatar.ts` — pobieranie skina i renderowanie
- `src/types/minecraft.ts` (modyfikacja)

## Zależności
TASK-10

## Fixy przeniesione z TASK-13

Poniższe problemy z TASK-13 (Uruchamianie Vanilla) wymagają poprawek UI/UX w tym tasku:

### 🔴 Fix 1: Obsługa błędów w `handleLaunch` — komunikacja w UI

**Problem:** Funkcja `handleLaunch` w `InstanceView.tsx` nie pokazuje błędów użytkownikowi. Gdy `resolveVersion()`, `download_client_jar()` lub `download_libraries()` rzuci błędem, przycisk zostaje w "Uruchamianie..." bez informacji zwrotnej.

**Fix:** Połącz z nowym stanem błędu w `useLaunch` (który będzie naprawiony w TASK-26) i wyświetl czytelny komunikat błędu w UI:
- W `LaunchButton` — pokaż ikonę błędu i komunikat "Nie udało się uruchomić: <przyczyna>" z przyciskiem "Spróbuj ponownie"
- W `GameConsole` — dodaj czerwoną linię z komunikatem błędu
- Rozważ dodanie toast notification (shadcn sonner) dla krytycznych błędów

### 🟡 Fix 3 (UI): Brak sygnalizacji błędu w `useLaunch.stop`

**Problem:** `stop()` wycisza błędy — użytkownik nie wie że zatrzymanie się nie udało.

**Fix:** Dodaj stan błędu do `LaunchButton` również dla akcji zatrzymywania. Jeśli `stop()` zwróci błąd, pokaż krótki toast lub tooltip.

## Szczegóły implementacji
1. Pobierz skin gracza: użyj API Mojang `https://sessionserver.mojang.com/session/minecraft/profile/<uuid>` lub bezpośrednio `https://crafatar.com/avatars/<uuid>` (zewnętrzne API do renderowania awatarów).
2. `AvatarRenderer` — komponent renderujący awatar 2D: głowa skina (front view) w rozmiarze configurowalnym (domyślnie 64x64 lub 128x128), płaski styl (bez WebGL, czysty canvas 2D lub img).
3. Fallback: jeśli nie uda się pobrać skina, pokaż domyślną ikonę (Steve).
4. `ProfileTab` — zakładka w widoku instancji zawierająca: awatar, nazwa gracza (gamertag), UUID, informacje o koncie (status online/offline), przycisk "Wyloguj", przycisk "Odśwież profil".
5. Cache: zapisz pobrany awatar lokalnie (`$APP_DATA/cache/avatars/<uuid>.png`), odświeżaj co 24h.
6. Avatar jest też wyświetlany w `AccountSwitcher` (TASK-10) jako miniatura (24x24).

## Definition of Done
- Avatar skina Minecraft jest wyświetlany w zakładce Profil.
- Fallback do Steve'a gdy brak skina.
- Nazwa gracza i UUID są wyświetlane.
- Awatar jest cachowany lokalnie.
- Awatar pojawia się też w przełączniku kont.
