# TASK-08 — Otwieranie folderu instancji

## Cel
Dodanie przycisku w UI który otwiera folder instancji w natywnym eksploratorze plików systemu operacyjnego.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/components/OpenFolderButton.tsx`
- `src/hooks/useOpenFolder.ts`
- `src-tauri/src/commands.rs` (modyfikacja — dodanie `open_instance_folder`)

## Zależności
TASK-05

## Szczegóły implementacji
1. Backend: komenda `open_instance_folder(name: String)` która wywołuje `open::that(path)` lub `tauri::api::shell::open` na ścieżce katalogu instancji.
2. Frontend: przycisk "Otwórz folder" w widoku instancji (np. w zakładce Profil lub w headerze widoku instancji).
3. Przycisk powinien być dostępny tylko gdy instancja istnieje na dysku.
4. Obsługa błędów: jeśli folder nie istnieje, zwróć błąd.

## Definition of Done
- Kliknięcie przycisku otwiera folder instancji w Eksploratorze (Windows), Finderze (macOS) lub domyślnym menedżerze plików (Linux).
- Przycisk jest widoczny w UI tylko gdy instancja istnieje.
