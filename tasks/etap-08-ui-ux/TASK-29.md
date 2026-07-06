# TASK-29 — Testy końcowe

## Cel
Przeprowadzenie kompleksowych testów całego launchera — testy jednostkowe, integracyjne i manualne scenariusze E2E — przed wydaniem MVP.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/tests/` — testy jednostkowe Rust
- `src/__tests__/` — testy jednostkowe TypeScript
- `src/__tests__/integration/` — testy integracyjne
- `scripts/test-manual.md` — scenariusze testów manualnych
- `src-tauri/Cargo.toml` (modyfikacja — dodanie dev-dependencies dla testów)

## Zależności
TASK-01 do TASK-28c

## Szczegóły implementacji
1. Testy jednostkowe Rust dla: `manifest.rs` (serializacja, deserializacja, migracja), `instance_manager.rs` (CRUD operacje), `download_manager.rs` (kolejka, pauza, resume), `snapshot.rs` (tworzenie, przywracanie), `java_manager.rs` (pobieranie, weryfikacja).
2. Testy jednostkowe TypeScript dla: `manifest.ts` (walidacja, migracja), `auth.ts` (flow autoryzacji), `modrinth.ts` (API klient), `minecraft-core.ts` (resolver wersji).
3. Testy integracyjne: testuj komendy Tauri przez `tauri::test` (symulacja wywołań frontendowych), testuj pełen flow tworzenia i uruchamiania instancji (mock Java).
4. Scenariusze testów manualnych (`scripts/test-manual.md`):
   - Instalacja i pierwsze uruchomienie
   - Tworzenie instancji Vanilla i Fabric
   - Logowanie Microsoft
   - Instalacja i aktualizacja modów
   - Eksport/Import ZIP
   - Snapshot i przywracanie
   - Tryb offline
   - Obsługa błędów (brak Java, brak tokenu, crash gry)
5. Testy wydajnościowe: czas uruchamiania aplikacji, czas pobierania assetów, użycie RAM przez launcher.
6. Testy na wszystkich docelowych platformach (Windows, Linux, macOS) — przynajmniej Windows + jedna inna.
7. Raport z testów: lista przetestowanych scenariuszy, znalezione bugi, status (PASS/FAIL).

## Definition of Done
- Wszystkie testy jednostkowe TypeScript przechodzą.
- Wszystkie testy jednostkowe Rust przechodzą (`cargo test`).
- Główne scenariusze E2E są przetestowane manualnie.
- Raport z testów jest gotowy.
- Znalezione bugi są zgłoszone (lub naprawione).
- Wszystkie bugi sklasyfikowane jako Critical lub Major są naprawione lub mają udokumentowane workaroundy.
- Wszystkie scenariusze w `scripts/test-manual.md` mają status PASS.
- Raport z testów jest zaakceptowany przez autora projektu.
