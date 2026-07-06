# TASK-16 — Kolejka pobrań

## Cel
Stworzenie centralnego systemu kolejki pobrań (Download Manager) z obsługą równoległych pobrań, wstrzymywania, wznawiania i anulowania.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/download_manager.rs` — główna logika menedżera pobrań w Rust
- `src-tauri/src/download_task.rs` — struktura taska pobierania
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/download-manager.ts` — frontend API do zarządzania kolejką
- `src/hooks/useDownloadQueue.ts`
- `src/components/DownloadQueue.tsx` — panel kolejki w UI
- `src/components/DownloadItem.tsx` — pojedynczy element kolejki

## Zależności
TASK-01

## Szczegóły implementacji
1. Backend Rust: struktura `DownloadTask` z polami `id`, `url`, `destination`, `size`, `downloaded`, `status` (Pending/Downloading/Paused/Completed/Failed/Cancelled).
2. Kolejka w Rust: `DownloadManager` zarządza wieloma taskami, obsługuje maksymalną liczbę równoległych pobrań (np. 4), priorytety (jeśli potrzebne).
3. HTTP downloading: użyj `reqwest` z async/await, obsługa `Content-Range` dla resume.
4. Operacje na kolejce: `enqueue(task)`, `pause(id)`, `resume(id)`, `cancel(id)`, `get_status(id)`, `list_all()`.
5. Postęp: każdy task emituje Tauri Event `download:progress` z `{ id, downloaded, total, speed }`.
6. Frontend: `DownloadQueue` — panel (Sheet) z listą aktywnych/zakończonych pobrań, paskami postępu, przyciskami pauzy/resume/cancel.
7. `useDownloadQueue` — hook subskrybujący się do eventów Tauri i aktualizujący stan.
8. Persistence: kolejka jest zapisywana do pliku JSON przy zamknięciu i odtwarzana przy starcie.
9. Wznawianie (resume): sprawdź rozmiar już pobranego pliku, ustaw nagłówek `Range` w requeście.

## Definition of Done
- Pobrania są dodawane do kolejki i wykonywane równolegle (max 4).
- Pauza/Zatrzymaj/Wznów działają na pojedynczych taskach.
- Postęp pobierania jest raportowany do frontendu w czasie rzeczywistym.
- Panel kolejki w UI pokazuje wszystkie pobrania z paskami postępu.
- Resume działa po przerwaniu pobierania (częściowy plik).
- Kolejka jest zapisywana i odtwarzana między sesjami.
