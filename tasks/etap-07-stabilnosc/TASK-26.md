# TASK-26 — Logi w czasie rzeczywistym (terminal VS Code)

## Cel
Real-time streaming logów z gry do UI przez Tauri Events, wyświetlanych w wysuwanym dolnym panelu stylizowanym na terminal VS Code.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/process_manager.rs` (modyfikacja — streaming logów)
- `src-tauri/src/log_parser.rs` — parsowanie logów Minecraft
- `src/hooks/useGameLogs.ts`
- `src/components/LogPanel.tsx` — wysuwany dolny panel (Sheet) z terminalem
- `src/components/LogToolbar.tsx` — narzędzia (clear, auto-scroll, filter)

## Zależności
TASK-13

## Szczegóły implementacji
1. Proces gry (z TASK-13): przechwytuj stdout i stderr procesu Java, wysyłaj każdą linię jako Tauri Event `game:log`.
2. **LogPanel** — wysuwany panel od dołu (Sheet z shadcn/ui), stylizowany na terminal VS Code:
   - Tło: `#1E1E1E` (ciemniejszy niż główne tło), monospace font
   - Border u góry: cienka linia z fioletowym akcentem
   - Wysokość: domyślnie 200px, rozciągalny (drag handle)
   - Przycisk toggle w stopce strony: "Pokaż logi" / "Ukryj logi" z ikonką terminala
3. `LogViewer` wewnątrz panelu:
   - Wirtualizowana lista (react-window), monospace (`'Cascadia Code', 'Fira Code', monospace`)
   - Kolorowanie: stdout = jasnoszary, stderr = czerwony, warn = żółty, info = niebieski
   - INFO/DEBUG/WARN/ERROR z Minecrafta podświetlane
   - Auto-scroll (można wyłączyć)
4. `LogToolbar`: przycisk "Wyczyść", przełącznik auto-scroll, wyszukiwarka (podświetlenie + przewijanie do trafień), przycisk "Zapisz" (zapisuje do pliku w folderze instancji).
5. `useGameLogs` — ring buffer ostatnich 5000 linii, subskrypcja `game:log`.
6. LogPanel dostępny po uruchomieniu gry (lub z ostatnimi logami z sesji).
7. Po zamknięciu gry: adnotacja "Gra zakończona z kodem <code>" na końcu logów.
8. Parsowanie: wykrywanie kluczowych momentów ("Done loading", "Mod resolution", "Joining world") z odpowiednim podświetleniem.

## Fixy przeniesione z TASK-13

Poniższe problemy z TASK-13 (Uruchamianie Vanilla) wymagają poprawy w tym tasku:

### 🔴 Fix 1: Obsługa błędów w `handleLaunch` (InstanceView.tsx)

**Problem:** Funkcja `handleLaunch` wykonuje sekwencję: resolveVersion → download_client_jar → download_libraries → generateLaunchArgs → launch. Jeśli którykolwiek z kroków 1-4 rzuci błędem (brak internetu, nieznana wersja, dysk pełny), `catch` tylko loguje do konsoli — stan `useLaunch` pozostaje na `"launching"`, przycisk zostaje ze spinnerem bez możliwości odzyskania.

**Fix:** W `catch` bloku ustaw stan błędu na hooku `useLaunch`, np. `setError(message)`, żeby przycisk wrócił do stanu "Spróbuj ponownie".

### 🟡 Fix 2: Race condition w monitor thread (`process_manager.rs`)

**Problem:** W `launch()` jest osobny wątek który czeka 500ms, a potem emituje `instance:launched`. Jeśli proces Java zcrashuje w ciągu tych 500ms (złe argumenty, brak Javy, uszkodzony JAR), UI i tak dostanie event "launched" i przełączy się na stan running z przyciskiem "Zatrzymaj" — ale proces już nie żyje.

**Fix:** Wyślij `instance:launched` synchronicznie zaraz po spawnie procesu, przed zwróceniem `Ok(...)`. Usuń monitor thread — nie jest potrzebny.

### 🟡 Fix 3: Brak sygnalizacji błędu w `useLaunch.stop`

**Problem:** Kiedy `stop()` zawiedzie (proces nie był zarządzany przez nasz manager), błąd jest wyciszony w `catch {}`. Użytkownik może utknąć w stanie, z którego nie da się wyjść.

**Fix:** Ustaw stan błędu z komunikatem zamiast wyciszać `catch {}`.

## Definition of Done
- Logi są przesyłane w czasie rzeczywistym.
- LogPanel wygląda jak terminal VS Code (#1E1E1E, monospace, fioletowy border).
- Panel jest wysuwany i rozciągalny.
- Kolorowanie linii i auto-scroll działają.
- Wyszukiwarka podświetla trafienia.
- Logi pozostają po zamknięciu gry z adnotacją o kodzie wyjścia.
