# Raport z Audytu Technicznego Projektu AnonLauncher
**Data:** Lipiec 2026
**Status:** Krytyczny (Wymaga natychmiastowych poprawek bezpieczeństwa)
**Audytor:** Principal Software Engineer & Security Architect

---

## Spis Treści
1. [Podsumowanie Wykonawcze](#podsumowanie-wykonawcze)
2. [Ocena Ogólna (Scores)](#ocena-ogólna)
3. [Audyt Bezpieczeństwa](#1-bezpieczeństwo)
4. [Architektura i Backend (Rust)](#2-architektura-i-backend)
5. [Frontend (React + TypeScript)](#3-frontend)
6. [Wydajność i Niezawodność](#4-wydajność-i-niezawodność)
7. [UX i Utrzymywalność](#5-ux-i-utrzymywalność)
8. [Rekomendacje Strategiczne](#rekomendacje-strategiczne)
    - [Top 20 Ulepszeń](#top-20-ulepszeń-o-najwyższym-wpływie)
    - [Top 10 Pre-release Fixes](#top-10-poprawek-przed-pierwszym-wydaniem)
    - [Top 10 Quick Wins](#top-10-szybkich-zwycięstw)
9. [Podsumowanie Techniczne](#podsumowanie-techniczne)

---

## Podsumowanie Wykonawcze
AnonLauncher to funkcjonalnie kompletny launcher Minecrafta oparty na Tauri v2 i React 19. Projekt wykazuje się dużą dojrzałością interfejsu użytkownika i logiki biznesowej (obsługa instancji, modów, snapshotów). Jednakże, audyt wykazał **krytyczne luki w bezpieczeństwie** związane z obsługą sekretów, brakami w walidacji pobieranych plików oraz nieoptymalnym wykorzystaniem modelu asynchronicznego w języku Rust. W obecnym stanie projekt nie nadaje się do publicznej dystrybucji.

---

## Ocena Ogólna

| Kategoria | Wynik | Opis |
| :--- | :---: | :--- |
| **Ogólny Wynik** | **6.2/10** | Solidna funkcjonalność, ale fundamenty bezpieczeństwa wymagają przebudowy. |
| Architektura | 7/10 | Jasny podział odpowiedzialności, ale duża duplikacja pomocnicza w Rust. |
| Frontend | 8.5/10 | Bardzo wysoka jakość kodu React 19, wzorowe użycie hooków. |
| Backend | 5.5/10 | Zbyt dużo operacji blokujących, brak pełnego async, brak testów. |
| Bezpieczeństwo | **2/10** | **Krytyczne: Hardcoded klucze, brak CSP, tokeny w plaintext.** |
| Wydajność | 7.5/10 | Równoległe pobieranie assetów jest plusem, Base64 dla obrazów to minus. |
| Utrzymywalność | 6/10 | Brak testów automatycznych utrudnia rozwój w modelu Open Source. |
| Gotowość Open Source | 7/10 | Dokumentacja README jest dobra, ale brakuje CI/CD i procedur security. |
| Gotowość Produkcyjna | 4/10 | Wymaga "hardeningu" przed udostępnieniem użytkownikom. |

---

## 1. Bezpieczeństwo

### 🔴 Krytyczne: Hardcoded Hasło Stronghold
- **Plik:** `src/lib/stronghold.ts` (linia 14)
- **Wyjaśnienie:** Stała `VAULT_PASSWORD` o wartości `"anonlauncher-stronghold-v1-fixed-key"` jest zapisana bezpośrednio w kodzie.
- **Dlaczego to ważne:** Szyfrowanie Stronghold chroni przed dostępem osób trzecich do plików. Jeśli hasło jest publicznie znane (w kodzie), szyfrowanie staje się bezużyteczne. Każdy złośliwy program może odszyfrować tokeny użytkownika.
- **Sugerowane rozwiązanie:** Hasło powinno być generowane per-instalacja i przechowywane w systemowym menedżerze haseł (np. OS Keychain/Credential Manager).
- **Przykład:**
```typescript
// Zamiast stałej, pobierz z backendu Tauri który odczyta z systemowego keychaina
const vaultPassword = await invoke("get_secure_app_secret");
```

### 🔴 Wysokie: Tokeny Access/Refresh w localStorage (Plaintext)
- **Plik:** `src/lib/accounts.ts` (funkcje `saveAccountSession`, `getActiveSession`)
- **Wyjaśnienie:** Wrażliwe dane sesji (w tym `accessToken`) są zapisywane w `localStorage` jako zwykły JSON.
- **Dlaczego to ważne:** Dane w `localStorage` są dostępne dla każdego skryptu działającego w kontekście Webview. W przypadku luki XSS, atakujący może natychmiast przejąć konto Minecraft użytkownika.
- **Sugerowane rozwiązanie:** Wszystkie tokeny muszą być przechowywane wyłącznie po stronie Rusta (w pamięci lub zaszyfrowanym Stronghold). Frontend powinien operować na nieprzezroczystych identyfikatorach sesji.

### 🔴 Wysokie: Brak Content Security Policy (CSP)
- **Plik:** `src-tauri/tauri.conf.json`
- **Wyjaśnienie:** Pole `csp` jest ustawione na `null`.
- **Dlaczego to ważne:** Aplikacja ładuje treści z zewnątrz (opisy modów z Modrinth jako HTML). Bez CSP atakujący może wstrzyknąć złośliwy skrypt (XSS), który wykradnie tokeny z `localStorage` lub wykona nieautoryzowane komendy Tauri.
- **Sugerowane rozwiązanie:** Wprowadź restrykcyjne CSP, np.: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: https: data:; connect-src 'self' https://api.modrinth.com https://piston-meta.mojang.com;`.

### 🟡 Średnie: Ryzyko Path Traversal przy imporcie ZIP
- **Plik:** `src-tauri/src/zip_import.rs`, `src-tauri/src/modpack_installer.rs`
- **Wyjaśnienie:** Brak weryfikacji ścieżek plików wewnątrz archiwum ZIP przed wypakowaniem.
- **Dlaczego to ważne:** Atakujący może przygotować spreparowany plik ZIP z nazwami plików typu `../../etc/shadow` lub `../../Desktop/virus.exe`, co pozwoli na zapisanie pliku poza katalogiem instancji ("Zip Slip" vulnerability).
- **Sugerowane rozwiązanie:** Zawsze weryfikuj, czy docelowa ścieżka po `join()` nadal znajduje się wewnątrz katalogu instancji (użyj `canonicalize` lub sprawdź prefix).

---

## 2. Architektura i Backend

### 🟡 Średnie: Duplikacja Funkcji Sanityzacji
- **Pliki:** `src-tauri/src/instance_manager.rs`, `mod_installer.rs`, `zip_export.rs`, `game_data.rs`, `snapshot.rs`
- **Wyjaśnienie:** Ta sama funkcja `sanitize_name` jest skopiowana do co najmniej 5 modułów.
- **Dlaczego to ważne:** Narusza zasadę DRY (Don't Repeat Yourself). Jeśli logika sanityzacji ulegnie zmianie (np. dopuszczenie nowych znaków), trzeba ją poprawić w 5 miejscach. Zwiększa to ryzyko błędów (niespójność nazw folderów).
- **Sugerowane rozwiązanie:** Przenieś funkcję do wspólnego modułu `utils.rs` i importuj ją tam, gdzie jest potrzebna.

### 🟡 Średnie: Synchronizowane (Blokujące) Pobieranie Plików
- **Pliki:** `src-tauri/src/minecraft_core.rs`, `java_manager.rs`, `content_installer.rs`
- **Wyjaśnienie:** Użycie `reqwest::blocking` wewnątrz commandów Tauri lub ręcznie spawnowanych wątków.
- **Dlaczego to ważne:** Blokowanie wątków systemowych w Tauri nie jest zalecane. W Tauri v2 standardem jest asynchroniczny `reqwest` (non-blocking) w połączeniu z `tokio`. Obecna implementacja utrudnia też wprowadzenie sprawnego przerywania (cancellation) pobierania.
- **Sugerowane rozwiązanie:** Przepisz moduły na `async fn` z użyciem `tokio` i asynchronicznego klienta HTTP.

### 🟡 Średnie: Brak Weryfikacji Integralności (Checksums)
- **Pliki:** `src-tauri/src/modpack_installer.rs`, `content_installer.rs`
- **Wyjaśnienie:** Pobierane mody i pliki .mrpack są zapisywane na dysku bez weryfikacji sumy kontrolnej SHA1/SHA512.
- **Dlaczego to ważne:** Ryzyko ataków typu Man-in-the-Middle lub pobrania uszkodzonych plików. Modrinth API udostępnia hashe dla każdego pliku — aplikacja powinna je sprawdzać.
- **Sugerowane rozwiązanie:** Po pobraniu pliku oblicz jego hash (używając biblioteki `sha2`) i porównaj z wartością z API przed rejestracją w systemie.

---

## 3. Frontend

### 🟢 Pozytywne: Nowoczesne Wzorce React 19
- **Obserwacja:** Wykorzystanie hooków do separacji logiki (np. `useLaunch`, `useModSearch`) jest na bardzo wysokim poziomie. Kod jest czytelny, typowany i dobrze obsługuje stany asynchroniczne.

### 🟡 Niskie: Potencjalny Memory Leak w `useLaunch`
- **Plik:** `src/hooks/useLaunch.ts`
- **Wyjaśnienie:** `recentLinesRef` (Set do deduplikacji logów) jest czyszczony tylko przy ręcznym wywołaniu `clearLogs`.
- **Dlaczego to ważne:** Jeśli użytkownik gra przez wiele godzin i generuje miliony unikalnych linii logów (np. błędy w pętli), `Set` w pamięci RAM będzie rósł w nieskończoność.
- **Sugerowane rozwiązanie:** Wprowadź mechanizm usuwania najstarszych wpisów z `Set` po osiągnięciu limitu (np. 1000 linii).

### 🟡 Średnie: Base64 dla Zrzutów Ekranu
- **Plik:** `src-tauri/src/game_data.rs` (funkcja `read_image_as_base64`)
- **Wyjaśnienie:** Zdjęcia z gry są konwertowane na gigantyczne stringi Base64 i przesyłane przez mostek IPC.
- **Dlaczego to ważne:** Bardzo duże zużycie procesora i pamięci przy przesyłaniu i renderowaniu. Tauri v2 posiada dedykowany protokół `asset://` do serwowania plików lokalnych.
- **Sugerowane rozwiązanie:** Zamiast Base64, zwracaj ścieżkę do pliku i używaj `convertFileSrc` z `@tauri-apps/api/core` po stronie frontendu.

---

## 4. Wydajność i Niezawodność

### 🟡 Średnie: Brak Obsługi Wycieku Procesów
- **Plik:** `src-tauri/src/process_manager.rs`
- **Wyjaśnienie:** Jeśli główna aplikacja AnonLauncher ulegnie awarii (crash) lub zostanie zamknięta przez Task Manager, proces Minecrafta (Java) pozostaje "osierocony".
- **Dlaczego to ważne:** Może to prowadzić do konfliktów przy próbie ponownego uruchomienia i niepotrzebnie zajmuje zasoby systemowe.
- **Sugerowane rozwiązanie:** Użyj mechanizmu "job objects" na Windows lub monitorowania PID rodzica w wrapperze, aby upewnić się, że Minecraft zamknie się wraz z launcherem.

### 🟡 Niskie: Brak Wykrywania Braku Miejsca na Dysku
- **Problem:** Operacje eksportu ZIP (`zip_export.rs`) i pobierania plików nie sprawdzają dostępnej przestrzeni.
- **Sugerowane rozwiązanie:** Przed rozpoczęciem pobierania bibliotek (~500MB+) lub eksportu ZIP, sprawdź wolne miejsce na partycji docelowej.

---

## 5. UX i Utrzymywalność

### 🟡 Średnie: Brak Testów Automatycznych
- **Problem:** Cały system generowania argumentów launchera (`lib/minecraft-core.ts`) i rezolucji wersji nie posiada testów jednostkowych.
- **Dlaczego to ważne:** Zmiana w logice generowania classpath może "popsuć" uruchamianie gry dla tysięcy użytkowników. To kod krytyczny, który musi być przetestowany na dziesiątkach wariantów wersji MC.
- **Sugerowane rozwiązanie:** Dodaj testy Vitest dla `lib/` oraz testy Rusta dla `manifest_migration.rs`.

### 🟡 Niskie: Słabe UX przy Błędach Java
- **Obserwacja:** Jeśli użytkownik nie ma zainstalowanej Javy, launcher pokazuje błąd "Failed to launch".
- **Sugerowane rozwiązanie:** Launcher powinien automatycznie proponować pobranie odpowiedniej wersji Javy przez wbudowany `java_manager` po wykryciu jej braku.

---

## Rekomendacje Strategiczne

### Top 20 Ulepszeń o Najwyższym Wpływie

| Lp | Rekomendacja | Kategoria | Wysiłek | Wpływ |
|:---|:---|:---:|:---:|:---:|
| 1 | Usunięcie hardcoded `VAULT_PASSWORD` | Security | Medium | **Critical** |
| 2 | Przeniesienie tokenów z `localStorage` do Rusta | Security | Medium | **High** |
| 3 | Włączenie i konfiguracja CSP w Tauri | Security | Low | **High** |
| 4 | Pełny asynchroniczny backend (Tokio + async fs) | Arch | High | Medium |
| 5 | Walidacja sum kontrolnych (Hash) wszystkich plików | Reliability | Medium | **High** |
| 6 | Zastąpienie Base64 protokołem `asset://` | Perf | Low | Medium |
| 7 | Wprowadzenie testów E2E (Playwright) | Testing | High | **High** |
| 8 | Refaktor sanityzacji nazw (DRY) | Arch | Low | Low |
| 9 | Walidacja "Zip Slip" przy imporcie/modpackach | Security | Medium | **High** |
| 10 | Automatyczna generacja typów TS z Rusta (Specta) | DevExp | Medium | Medium |
| 11 | Implementacja Microsoft MSAL (zamiast Device Flow) | UX | Medium | Medium |
| 12 | System logowania zdarzeń (np. `tauri-plugin-log`) | Reliability | Low | Medium |
| 13 | Obsługa przerywania (Abort) pobierania | UX | Medium | Low |
| 14 | Unit testy dla generatora argumentów JVM | Testing | Medium | **High** |
| 15 | Wykrywanie osieroconych procesów Minecraft | Reliability | Medium | Medium |
| 16 | Dodanie licencji i Contribution Guide | OpenSource | Low | Medium |
| 17 | Optymalizacja startu: lazy load ciężkich modułów | Perf | Medium | Low |
| 18 | Automatyczne sprawdzanie aktualizacji Javy | UX | Medium | Low |
| 19 | Wsparcie dla innych loaderów (Quilt/NeoForge) | Feature | High | Medium |
| 20 | Integracja z systemowym powiadomieniami | UX | Low | Low |

### Top 10 Poprawek przed pierwszym wydaniem
1. **Bezpieczeństwo:** Usunięcie hasła Stronghold z kodu.
2. **Bezpieczeństwo:** Usunięcie tokenów z `localStorage`.
3. **Bezpieczeństwo:** Skonfigurowanie CSP.
4. **Niezawodność:** Weryfikacja sum kontrolnych pobieranych bibliotek.
5. **Niezawodność:** Naprawa luki Path Traversal w ZIP.
6. **UX:** Poprawna obsługa braku Javy w systemie.
7. **Prawne:** Dodanie pliku LICENSE i poprawnego opisu prywatności (Microsoft Auth).
8. **Testy:** Dodanie testów dla migracji manifestów (v1 -> future).
9. **UI:** Walidacja unikalności nazw instancji przy tworzeniu.
10. **Build:** Konfiguracja automatycznego podpisywania kodu (Code Signing).

### Top 10 Szybkich Zwycięstw
1. Usunięcie duplikacji `sanitize_name`.
2. Zamiana Base64 na `convertFileSrc`.
3. Dodanie ikony aplikacji do bundle systemowego.
4. Tooltipy dla przycisków akcji w HeroCard.
5. Automatyczny focus na polu wyszukiwania modów.
6. Przycisk "Kopiuj do schowka" w logach gry.
7. Ciemny motyw jako domyślny bazując na ustawieniach OS.
8. Badge "Nowa" przy nowo pobranych instancjach.
9. Link do folderu crash-report w banerze błędu.
10. Dodanie wersji aplikacji w tytule okna (Settings).

---

## Podsumowanie Techniczne

### Dług Techniczny
- **Rust Async:** Backend wymaga ujednolicenia. Mieszanie `std::thread` i `blocking` I/O utrudni skalowanie aplikacji w przyszłości.
- **Globalne Zarządzanie Stanem:** Aplikacja polega głównie na hookach i lokalnym stanie. Przy wzroście skomplikowania (np. globalny status pobierania w tle), konieczne będzie wprowadzenie Zustanda lub TanStack Query.

### Wydajność
- **Startup Time:** Jest wzorowy (~300ms) dzięki Tauri v2.
- **Resource Usage:** Niskie, ale Base64 dla zdjęć powoduje niepotrzebne piki zużycia RAM.

### Bezpieczeństwo (Krytyczne)
Projekt obecnie **nie spełnia standardów bezpieczeństwa 2026**. Wszystkie klucze i tokeny są zbyt łatwo dostępne dla potencjalnego złośliwego oprogramowania. Jest to priorytet #1 przed jakimkolwiek publicznym demo.

---

**Ocena końcowa:** Solidny fundament z wybitnym frontendem, wymagający gruntownego wzmocnienia warstwy bezpieczeństwa i backendu.
