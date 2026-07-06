# TASK-31 — Edycja ustawień instancji

## Cel
Umożliwienie użytkownikowi edycji konfiguracji istniejącej instancji: nazwy, przydzielonego RAM, wersji Java, wersji Fabric Loader oraz parametrów JVM.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/components/EditInstanceDialog.tsx`
- `src/components/EditInstanceForm.tsx` (bazuje na CreateInstanceForm z TASK-05)
- `src-tauri/src/instance_manager.rs` (modyfikacja — dodanie `update_instance`)
- `src-tauri/src/commands.rs` (modyfikacja)

## Zależności
TASK-05

## Szczegóły implementacji
1. Dodaj opcję "Edytuj" do menu kontekstowego karty instancji (obok "Usuń" z TASK-30).
2. `EditInstanceDialog` — modal z formularzem pre-populated danymi z manifestu:
   - Nazwa instancji (edytowalna, ta sama walidacja co w TASK-05)
   - RAM (suwak, min 1024 MB, krok 512 MB)
   - Wersja Java (dropdown z wykrytymi/pobranymi wersjami z TASK-11)
   - Dodatkowe parametry JVM (textarea, np. `-XX:+UseG1GC`)
   - Wersja Fabric Loader (jeśli instancja Fabric — dropdown z dostępnymi wersjami)
3. Backend Rust: komenda `update_instance(name: String, updates: InstanceManifest)` aktualizuje plik `instance.json`, ustawia `updatedAt` na aktualną datę.
4. Zmiana nazwy instancji: przemianuj folder instancji na dysku.
5. Walidacja: nowa nazwa nie może kolidować z istniejącą inną instancją.
6. Po zapisie: zamknij modal, odśwież kartę instancji na Dashboardzie, toast "Ustawienia instancji zostały zaktualizowane".

## Definition of Done
- Opcja "Edytuj" jest dostępna dla każdej instancji.
- Formularz wyświetla aktualne wartości z manifestu.
- Zmiana RAM, Java, parametrów JVM jest zapisywana do manifestu.
- Zmiana nazwy instancji przemianowuje folder na dysku.
- Walidacja działa (kolizja nazw, puste pole).
- Toast potwierdza zapis.
