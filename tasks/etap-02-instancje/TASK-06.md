# TASK-06 — Klonowanie instancji

## Cel
Implementacja funkcji klonowania istniejącej instancji — użytkownik wybiera instancję źródłową, podaje nową nazwę, a launcher kopiuje cały katalog i tworzy nowy manifest.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/components/CloneInstanceDialog.tsx`
- `src/hooks/useCloneInstance.ts`
- `src-tauri/src/instance_manager.rs` (modyfikacja — dodanie `clone_instance`)
- `src-tauri/src/commands.rs` (modyfikacja)

## Zależności
TASK-05

## Szczegóły implementacji
1. Dialog klonowania: wybór instancji źródłowej (z listy istniejących), pole na nową nazwę, przycisk "Klonuj".
2. Backend: komenda `clone_instance(source: String, new_name: String)` która: kopiuje cały katalog źródłowej instancji do nowego katalogu, odczytuje manifest źródła, tworzy nowy manifest z nową nazwą i aktualnym `createdAt`/`updatedAt`.
3. Walidacja: nowa nazwa nie może być pusta ani zawierać znaków niedozwolonych, instancja o nowej nazwie nie może już istnieć.
4. Po sklonowaniu — odświeżenie Dashboardu i przekierowanie do nowej instancji.
5. Obsługa błędów (brak źródła, błąd kopiowania, duplikat nazwy).

## Definition of Done
- Użytkownik może sklonować instancję przez UI.
- Nowa instancja ma wszystkie pliki źródła (mody, konfiguracje itd.).
- Manifest nowej instancji ma zaktualizowane daty i nazwę.
- Oryginalna instancja pozostaje niezmieniona.
