# TASK-25 — Obsługa crash-reportów

## Cel
Implementacja wykrywania, odczytu i wyświetlania raportów crashy Minecraft (HS\_ERR\_PID.log, crash-reports/) w interfejsie użytkownika.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/crash_handler.rs` — obsługa crash raportów w Rust
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/crash-reports.ts` — frontend API
- `src/hooks/useCrashReports.ts`
- `src/components/CrashReportList.tsx` — lista crash raportów
- `src/components/CrashReportViewer.tsx` — podgląd treści raportu

## Zależności
TASK-13

## Szczegóły implementacji
1. Po zakończeniu procesu gry (TASK-13) z kodem wyjścia != 0: sprawdź katalog instancji pod kątem plików `hs_err_pid*.log` (JVM crash) oraz `crash-reports/crash-*.txt` (Minecraft crash).
2. Komenda `list_crash_reports(instanceName)` — skanuje katalogi i zwraca listę crash raportów z: filename, data/czas, typem (JVM / Minecraft).
3. Komenda `read_crash_report(instanceName, filename)` — zwraca treść pliku crash raportu.
4. Automatyczne wykrywanie: po zakończeniu gry (proces exits) sprawdź czy pojawiły się nowe crash raporty. Jeśli tak, wyświetl powiadomienie w UI.
5. UI: `CrashReportList` — lista crash raportów w zakładce "Logi" widoku instancji, z datą i typem, sortowane od najnowszych.
6. `CrashReportViewer` — podgląd treści z syntax highlighting (dla stack trace) i przyciskiem "Otwórz plik" (otwiera w domyślnym edytorze).
7. Czyszczenie starych crash raportów: przycisk "Usuń wszystkie" lub automatyczne usuwanie starszych niż 30 dni.

## Definition of Done
- Crash raporty (JVM i Minecraft) są wykrywane automatycznie po crashe gry.
- Lista crash raportów jest widoczna w UI.
- Treść crash raportu jest wyświetlana w czytelnym formacie.
- Powiadomienie o nowym crashe pojawia się po zamknięciu gry.
- Ręczne odświeżanie listy crash raportów działa.
