# TASK-21 — Aktualizacja modów

## Cel
Implementacja wykrywania i instalacji aktualizacji dla modów zainstalowanych przez Modrinth, z opcją aktualizacji pojedynczej lub zbiorczej.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/mod_updater.rs` — logika aktualizacji
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/mod-updater.ts` — frontend API
- `src/hooks/useModUpdates.ts`
- `src/components/ModUpdateBadge.tsx` — odznaka dostępności aktualizacji
- `src/components/ModUpdateDialog.tsx` — dialog ze szczegółami aktualizacji

## Zależności
TASK-20

## Szczegóły implementacji
1. Komenda `check_mod_updates(instanceName)` — dla każdego moda w `mods.json`: sprawdź najnowszą wersję w API Modrinth (`GET /v2/project/<projectId>/version`), porównaj z zainstalowaną wersją, zwróć listę modów z dostępnymi aktualizacjami.
2. Komenda `update_mod(instanceName, modName, newVersionId)` — pobiera nowy JAR, usuwa stary, aktualizuje wpis w `mods.json`.
3. Komenda `update_all_mods(instanceName)` — zbiorcza aktualizacja wszystkich modów z dostępnymi aktualizacjami.
4. UI: `ModUpdateBadge` — odznaka na karcie moda (lub na zakładce) informująca o dostępnej aktualizacji.
5. `ModUpdateDialog` — lista modów do aktualizacji z: starą wersją, nową wersją, changelogiem, checkboxem wyboru, przyciskiem "Aktualizuj zaznaczone".
6. Przed aktualizacją (jeśli snapshoty są zaimplementowane — TASK-23) zapytaj o wykonanie snapshotu.
7. Raportowanie postępu przez system z TASK-17 (postęp dla każdego moda i sumaryczny).

## Definition of Done
- Launcher wykrywa dostępne aktualizacje dla zainstalowanych modów.
- Pojedynczy mod może być zaktualizowany.
- Zbiorcza aktualizacja wszystkich modów działa.
- Stary JAR jest usuwany po udanej aktualizacji.
- Postęp aktualizacji jest raportowany.
