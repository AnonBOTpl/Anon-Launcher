# TASK-23 — Snapshoty

## Cel
Implementacja systemu snapshotów instancji z wyborem trybu (pełna kopia / tylko metadane) przed aktualizacją oraz możliwością ręcznego tworzenia snapshotów.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/snapshot.rs` — logika snapshotów w Rust
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/snapshot.ts` — frontend API
- `src/hooks/useSnapshots.ts`
- `src/components/SnapshotDialog.tsx` — dialog wyboru trybu snapshotu
- `src/components/SnapshotList.tsx` — lista snapshotów w widoku instancji

## Zależności
TASK-05

## Szczegóły implementacji
1. Komenda `create_snapshot(instanceName, mode: "full" | "metadata")`:
   - **Pełna kopia**: kopiuje cały katalog instancji do `$APP_DATA/instances/<instance>/snapshots/<timestamp>/`.
   - **Tylko metadane**: tworzy plik JSON z manifestem + listą modów (nazwa, wersja, enabled) + plik `mods.json` + lista zainstalowanych modów z wersjami. Zapisz do `snapshots/<timestamp>/metadata.json`.
2. Nazewnictwo snapshotów: folder z timestampem ISO (np. `2026-06-28T15-30-00Z`).
3. `SnapshotDialog` — pojawia się przed aktualizacją modów (z TASK-21), pyta: "Utworzyć snapshot przed aktualizacją?" z opcjami "Pełna kopia", "Tylko metadane", "Nie twórz". Opcjonalnie zapamiętaj wybór jako domyślny.
4. `SnapshotList` — lista snapshotów w widoku instancji (zakładka), z datą utworzenia, rozmiarem, typem, przyciskiem "Przywróć" (do TASK-24).
5. Ręczne tworzenie snapshotu: przycisk "Utwórz snapshot" w widoku instancji.
6. Usuwanie snapshotów: przycisk "Usuń" dla każdego snapshotu.
7. Maksymalna liczba snapshotów: limit configurowalny (np. 10), po przekroczeniu usuń najstarszy.

## Definition of Done
- Snapshot pełnej kopii tworzy kompletny backup instancji.
- Snapshot metadanych tworzy plik JSON z konfiguracją i listą modów.
- Dialog wyboru trybu pojawia się przed aktualizacją.
- Ręczne tworzenie snapshotu działa.
- Lista snapshotów jest widoczna w UI z datą i typem.
- Snapshoty są usuwane z UI i dysku.
