# TASK-18 — Pobieranie assetów i bibliotek

## Cel
Implementacja pobierania assetów Minecraft (dźwięki, tekstury, języki) oraz bibliotek gry przez Download Manager, wraz z weryfikacją integralności.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/asset_downloader.rs` — pobieranie assetów
- `src-tauri/src/library_downloader.rs` — pobieranie bibliotek
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/asset-manager.ts` — frontend API
- `src/hooks/useAssetDownload.ts`
- `src-tauri/src/download_manager.rs` (modyfikacja — integracja)

## Zależności
TASK-16, TASK-12

## Szczegóły implementacji
1. Assets: odczytaj `assetIndex` z metadata wersji (URL do `assets/<version>.json`), pobierz indeks, przeiteruj przez obiekty, pobierz każdy asset z `https://resources.download.minecraft.net/<hash[:2]>/<hash>`.
2. Assets są przechowywane w `$APP_DATA/assets/objects/` (zgodnie ze strukturą oryginalnego Minecrafta).
3. Weryfikacja: przed pobraniem sprawdź czy plik już istnieje i czy jego hash (SHA-1) zgadza się z indeksem. Pomiń jeśli poprawny.
4. Biblioteki: dla każdej biblioteki w liście (z TASK-12): sprawdź czy JAR istnieje w `$APP_DATA/libraries/`, jeśli nie — dodaj do kolejki pobrań.
5. Użyj Download Managera (TASK-16) dla wszystkich pobrań — każdy asset i biblioteka to osobny task w kolejce.
6. Grupuj pobrania: assets jako jeden batch "Pobieranie assetów", libraries jako "Pobieranie bibliotek" dla lepszego UX.
7. Raportowanie postępu przez system z TASK-17.
8. Obsługa błędów: jeśli pobranie assetu się nie powiedzie, kontynuuj z pozostałymi i zgłoś błąd na końcu.

## Definition of Done
- Assety są pobierane i weryfikowane przed uruchomieniem gry.
- Biblioteki są pobierane przed uruchomieniem gry.
- Pobieranie używa Download Managera (kolejka, postęp, resume).
- Istniejące poprawne pliki są pomijane (nie pobierane ponownie).
- Błędy pobierania są raportowane.
