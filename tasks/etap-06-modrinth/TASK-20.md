# TASK-20 — Instalacja modów

## Cel
Implementacja instalacji modów z Modrinth do wybranej instancji — pobieranie JARów, zarządzanie plikami modów, lista modów w UI.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/mod_installer.rs` — instalacja modów po stronie Rust
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/mod-installer.ts` — frontend API
- `src/hooks/useMods.ts`
- `src/components/ModList.tsx` — lista modów instancji
- `src/components/ModCard.tsx` — karta moda w liście
- `src/pages/InstanceMods.tsx` — zakładka modów w widoku instancji

## Zależności
TASK-19, TASK-16

## Szczegóły implementacji
1. Backend: komenda `install_mod(instanceName, modVersionId)` która: pobiera plik JAR z Modrinth API (`GET /v2/version/<versionId>/download`), zapisuje w `$APP_DATA/instances/<instanceName>/mods/`, rejestruje mod w pliku `mods.json` (lista zainstalowanych modów z wersjami).
2. Pobieranie przez Download Manager (TASK-16).
3. Lista modów: `get_mods(instanceName)` — czyta `mods.json` i zwraca listę z lokalnymi danymi (nazwa, wersja, enabled/disabled).
4. Włączanie/wyłączanie modów: zmiana rozszerzenia pliku na `.jar.disabled` lub przenoszenie do podfolderu. Komenda `toggle_mod(instanceName, modFileName, enabled)`.
5. UI: `InstanceMods` — zakładka z listą modów w instancji, każdy mod jako karta z: ikoną, nazwą, wersją, przełącznikiem enabled/disabled, przyciskiem "Odinstaluj".
6. Przycisk "Dodaj mod" otwiera wyszukiwarkę (TASK-19) z pre-selected wersją Minecraft instancji.
7. `Mods.json` format: `{ "mods": [{ "name", "versionId", "fileName", "enabled", "installedAt" }] }`.
8. Usuwanie moda: usuwa plik JAR i wpis z `mods.json`.

## Definition of Done
- Mod zainstalowany przez UI pojawia się w folderze `mods/` instancji.
- Mod można włączyć/wyłączyć przełącznikiem.
- Mod można odinstalować z UI.
- Lista modów w UI odpowiada stanowi na dysku.
- Instalacja przez Download Manager z postępem.
