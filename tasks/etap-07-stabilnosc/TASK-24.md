# TASK-24 — Przywracanie poprzedniego stanu

## Cel
Implementacja przywracania instancji z wcześniej utworzonego snapshotu — zarówno pełnej kopii, jak i tylko metadanych.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/snapshot.rs` (modyfikacja — dodanie restore)
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/snapshot.ts` (modyfikacja)
- `src/components/RestoreSnapshotDialog.tsx` — dialog potwierdzenia przywrócenia
- `src/hooks/useSnapshots.ts` (modyfikacja)

## Zależności
TASK-23

## Szczegóły implementacji
1. Komenda `restore_snapshot(instanceName, snapshotTimestamp, mode: "full" | "metadata")`:
   - Pełna kopia: usuń obecny katalog instancji (po potwierdzeniu), skopiuj snapshot z `snapshots/<timestamp>/` z powrotem do katalogu instancji.
   - Tylko metadane: przywróć `instance.json` z snapshotu (cofa zmiany w konfiguracji), przywróć listę modów w `mods.json` (ale nie przywraca plików JAR — ostrzeż użytkownika).
2. `RestoreSnapshotDialog` — potwierdzenie z informacją co zostanie przywrócone, ostrzeżenie o utracie bieżących danych (dla pełnej kopii), przycisk "Przywróć".
3. Przed przywróceniem pełnej kopii: opcjonalnie utwórz snapshot obecnego stanu (zabezpieczenie).
4. Po przywróceniu: odśwież UI instancji (lista modów, konfiguracja).
5. Dla snapshotu metadanych: wyświetl różnicę między obecnym stanem a snapshotem (lista modów które się zmieniły).

## Definition of Done
- Pełna kopia snapshotu jest przywracana (instancja wraca do stanu z snapshotu).
- Przywrócenie metadanych odtwarza config i listę modów.
- Dialog potwierdzenia pokazuje szczegóły operacji.
- UI odświeża się po przywróceniu.
- Ostrzeżenie o utracie danych dla pełnej kopii.
