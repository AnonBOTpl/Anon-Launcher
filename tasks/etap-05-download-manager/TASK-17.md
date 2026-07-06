# TASK-17 — Monitorowanie postępu

## Cel
Implementacja systemu raportowania postępu przez Tauri Events dla wszystkich długotrwałych operacji (download, kompresja, kopiowanie), wraz z komponentami UI do wyświetlania postępu.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/progress.rs` — unifikalny system raportowania postępu
- `src/hooks/useProgress.ts`
- `src/components/ProgressOverlay.tsx` — nakładka postępu dla operacji blokujących
- `src/components/ProgressToast.tsx` — toast z postępem
- `src-tauri/src/download_manager.rs` (modyfikacja — użycie systemu progress)
- `src-tauri/src/zip_export.rs` (modyfikacja — raportowanie postępu)

## Zależności
TASK-16

## Szczegóły implementacji
1. Zdefiniuj unifikalny format eventu Tauri: `operation:progress` z payloadem `{ operationId, operationType, label, current, total, status }`.
2. W backend: utwórz helper `emit_progress(operationId, label, current, total)` który wysyła event do frontendu.
3. Obsługiwane operacje: `download_file`, `extract_zip`, `compress_zip`, `copy_files`, `install_mods`.
4. Frontend: `useProgress` — hook subskrybujący się do `operation:progress`, zarządzający stanem aktywnych operacji.
5. `ProgressOverlay` — modalna nakładka dla operacji blokujących UI (np. wypakowywanie JRE, import ZIP) z paskiem postępu i przyciskiem anulowania (jeśli applicable).
6. `ProgressToast` — nieblokujący toast dla operacji w tle (pobieranie assetów, aktualizacja modów).
7. Każda operacja ma unikalne `operationId`, pozwalające na grupowanie wielu pod-operacji (np. pobieranie 10 plików = 1 operacja "Pobieranie assetów" z sumarycznym postępem).

## Definition of Done
- Wszystkie długotrwałe operacje raportują postęp do frontendu.
- `ProgressOverlay` wyświetla się dla operacji blokujących.
- `ProgressToast` wyświetla się dla operacji w tle.
- Postęp jest aktualizowany w czasie rzeczywistym.
- Anulowanie operacji z UI działa (gdzie applicable).
