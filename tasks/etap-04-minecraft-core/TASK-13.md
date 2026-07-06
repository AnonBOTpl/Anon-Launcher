# TASK-13 — Uruchamianie Vanilla

## Cel
Implementacja uruchamiania czystej (Vanilla) wersji Minecraft — od pobrania assetów i bibliotek po uruchomienie procesu Java z odpowiednimi argumentami.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/launcher.rs` — główna logika uruchamiania
- `src-tauri/src/process_manager.rs` — zarządzanie procesem Java (PID, monitoring, kill)
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/hooks/useLaunch.ts`
- `src/components/LaunchButton.tsx`
- `src/components/GameConsole.tsx` — podstawowy widok logów z gry

## Zależności
TASK-12, TASK-11, TASK-10

## Szczegóły implementacji
1. Backend Rust: komenda `launch_instance(instanceName: String)` która: odczytuje manifest instancji, znajduje ścieżkę do JRE (z TASK-11), generuje argumenty JVM/Minecraft (z TASK-12), uruchamia proces Java przy użyciu `tauri::api::process::Command` lub `std::process::Command`.
2. Process Manager w Rust: monitoruje PID procesu, streamuje stdout/stderr do frontendu przez Tauri Events, obsługuje zakończenie procesa (kod wyjścia, crash).
3. Ustaw zmienne środowiskowe przed uruchomieniem: `JAVA_HOME` (ścieżka do JRE), rozszerzenie classpath o natywne biblioteki.
4. Katalog gry (`gameDir`) ustaw na katalog instancji.
5. UI: `LaunchButton` — przycisk "Uruchom" w widoku instancji, zmienia stan na "Uruchamianie..." podczas procesu, "Uruchomiono" gdy gra działa. `GameConsole` — podstawowe okno z logami (stdout/stderr streamowane z procesu).
6. Obsługa błędów: jeśli Java nie jest dostępna → poproś o pobranie (TASK-11), jeśli brak tokenu → poproś o zalogowanie (TASK-09), jeśli proces nie może się uruchomić → wyświetl błąd.
7. Przycisk "Zatrzymaj" (kill procesu) gdy gra jest uruchomiona.

## Znane problemy do poprawy

### 🔴 1. `handleLaunch` — brak obsługi błędów pobierania

W `InstanceView.tsx` funkcja `handleLaunch` wykonuje sekwencję:
1. `resolveVersion()` — pobiera JSON wersji z Mojang API
2. `download_client_jar()` — ściąga client.jar
3. `download_libraries()` — ściąga biblioteki
4. `generateLaunchArgs()` — generuje argumenty
5. `launch()` — uruchamia proces

Jeśli którykolwiek z kroków 1-4 rzuci błędem (brak internetu, nieznana wersja, dysk pełny), `catch` tylko loguje do konsoli — **stan `useLaunch` pozostaje na `"launching"`**, przycisk zostaje ze spinnerem bez możliwości odzyskania.

**Fix (TASK-26/27):** W `catch` ustaw stan błędu na hooku, np. `setError(message)`, żeby przycisk wrócił do stanu "Spróbuj ponownie".

### 🟡 2. Race condition w monitor thread (`process_manager.rs`)

W `launch()` jest osobny wątek który czeka 500ms, a potem emituje `instance:launched`. Jeśli proces Java zcrashuje w ciągu tych 500ms (złe argumenty, brak Javy, uszkodzony JAR), UI i tak dostanie event "launched" i przełączy się na stan running z przyciskiem "Zatrzymaj" — ale proces już nie żyje.

**Fix (TASK-26/27):** Wyślij `instance:launched` synchronicznie zaraz po spawnie procesu, przed zwróceniem `Ok(...)`. Monitor thread nie jest potrzebny.

### 🟡 3. Brak sygnalizacji błędu w `useLaunch.stop`

Kiedy `stop()` zawiedzie (proces nie był zarządzany przez nasz manager), błąd jest wyciszony w `catch {}`. Użytkownik może utknąć w stanie, z którego nie da się wyjść.

**Fix (TASK-26/27):** Ustaw stan błędu z komunikatem zamiast wyciszać.

## Definition of Done
- Kliknięcie "Uruchom" pobiera brakujące biblioteki/assety i uruchamia grę.
- Gra uruchamia się z poprawnymi argumentami i classpathem.
- Logi z gry są streamowane do UI.
- Przycisk "Zatrzymaj" zabija proces gry.
- Błędy (brak Java, brak tokenu) są obsłużone z czytelnym komunikatem.
