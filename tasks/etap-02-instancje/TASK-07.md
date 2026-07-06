# TASK-07 — Eksport i import ZIP

## Cel
Implementacja eksportu instancji do archiwum ZIP oraz importu instancji z pliku ZIP, umożliwiająca przenoszenie instancji między komputerami.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/components/ExportInstanceDialog.tsx`
- `src/components/ImportInstanceDialog.tsx`
- `src-tauri/src/zip_export.rs` — logika eksportu ZIP w Rust
- `src-tauri/src/zip_import.rs` — logika importu ZIP w Rust
- `src-tauri/src/instance_manager.rs` (modyfikacja)
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/hooks/useFileDialog.ts`

## Zależności
TASK-05

## Szczegóły implementacji
1. Eksport: komenda `export_instance(name: String)` która kompresuje cały katalog instancji do pliku ZIP z tą samą nazwą, zapisuje ZIP w lokalizacji wskazanej przez natywne okno dialogu zapisu (Tauri dialog plugin).
2. Import: komenda `import_instance(path: String)` która: otwiera plik ZIP, weryfikuje czy zawiera poprawny manifest (`instance.json`), wypakowuje do katalogu instancji, aktualizuje manifest (nowa ścieżka).
3. Walidacja przy imporcie: sprawdź `schemaVersion` manifestu w ZIP, wykonaj migrację jeśli potrzebna, sprawdź czy instancja o tej nazwie już istnieje (zapytaj o nadpisanie lub zmianę nazwy).
4. UI: przycisk eksportu w widoku instancji (Sheet/DropdownMenu), przycisk importu na Dashboardzie.
5. Natywne okno dialogu plików do wyboru lokalizacji zapisu/odczytu ZIP.
6. Pasek postępu podczas kompresji/dekompresji (dla dużych instancji).

## Definition of Done
- Instancja jest eksportowana do ZIP i można ją otworzyć w dowolnym archiwizatorze.
- ZIP z instancji jest importowany z poprawnym odtworzeniem katalogu i manifestu.
- Walidacja manifestu w ZIP działa przed wypakowaniem.
- Obsługa duplikatów nazw przy imporcie działa.
