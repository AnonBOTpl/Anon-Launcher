# TASK-05 — Tworzenie instancji

## Cel
Implementacja pełnego flow tworzenia nowej instancji Minecraft — od formularza w UI po utworzenie katalogu i manifestu na dysku.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/pages/CreateInstance.tsx`
- `src/components/CreateInstanceForm.tsx`
- `src/components/VersionSelect.tsx`
- `src/components/LoaderSelect.tsx`
- `src/lib/minecraft-versions.ts` — funkcje do pobierania dostępnych wersji Minecraft
- `src-tauri/src/instance_manager.rs` (modyfikacja — dodanie `create_instance`)
- `src-tauri/src/commands.rs`

## Zależności
TASK-03

## Szczegóły implementacji
1. Formularz tworzenia instancji zawiera: nazwa instancji (wymagana, walidacja znaków dozwolonych w nazwie folderu), wybór wersji Minecraft (lista pobrana z API Mojang/metadata), wybór loadera (Vanilla | Fabric z selectem wersji loadera), suwak/number input do ustawienia RAM (domyślnie 4096 MB, krok 512 MB, min 1024 MB).
2. Pobierz dostępne wersje Minecraft z API Mojang (version_manifest.json) lub użyj `@xmcl/minecraft-core`.
3. Dla Fabric pobierz dostępne wersje loadera z API Fabric (meta.fabricmc.net) dla wybranej wersji Minecraft.
4. Backend Rust: komenda `create_instance` przyjmuje dane manifestu, tworzy katalog instancji (`$APP_DATA/instances/<nazwa>/`), zapisuje plik `instance.json`.
5. Walidacja po stronie frontendu: nazwa nie może być pusta, nie może zawierać znaków niedozwolonych w nazwie pliku, instancja o tej nazwie nie może już istnieć.
6. Po pomyślnym utworzeniu przekieruj użytkownika do Dashboardu.
7. Obsłuż błędy (duplikat nazwy, błąd zapisu) i wyświetl komunikat.

## Definition of Done
- Użytkownik może utworzyć instancję przez interfejs.
- Instancja pojawia się na Dashboardzie po utworzeniu.
- Katalog instancji i manifest są zapisane na dysku.
- Walidacja formularza działa (pusta nazwa, duplikat, nieprawidłowe znaki).
