# TASK-11 — Moduł pobierania Java (Adoptium)

## Cel
Implementacja automatycznego wykrywania, pobierania i zarządzania środowiskami Java (JRE) z API Adoptium (Eclipse Temurin) na podstawie wymaganej wersji Minecraft.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/lib/java.ts` — API dla frontendu
- `src-tauri/src/java_manager.rs` — pobieranie, weryfikacja, zarządzanie JRE
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/hooks/useJavaRuntime.ts`
- `src/components/JavaSettings.tsx`

## Zależności
TASK-01

## Szczegóły implementacji
1. Zintegruj się z API Adoptium Temurin (https://api.adoptium.net/v3/...) aby pobrać listę dostępnych wersji JRE dla platformy użytkownika (Windows x64, Linux x64, macOS x64/arm64).
2. Mapowanie wersji Minecraft na wersję Java: 1.17-1.20 → Java 17, 1.20.5+ → Java 21, itd.
3. Pobieranie: zaimplementuj własny prosty HTTP download (fetch + stream do pliku)
   bez kolejki i bez pauzowania. Refactor do Download Managera nastąpi w TASK-18.
   Nie importuj ani nie referencjonuj TASK-16 na tym etapie.
4. Wypakuj pobrane JRE do `$APP_DATA/java/<version>/`.
5. Weryfikacja: po pobraniu sprawdź czy `java -version` zwraca oczekiwaną wersję.
6. Rust: komendy `get_java_versions()` (lista dostępnych wersji), `download_java(version)` (pobiera i wypakowuje), `get_java_path(version)` (ścieżka do javy).
7. UI: `JavaSettings` — wybór wersji Java per instancja, status (dostępna lokalnie / do pobrania / pobieranie), przycisk "Pobierz".
8. Auto-detect: przy tworzeniu instancji sprawdź czy potrzebne JRE jest już pobrane, jeśli nie — zaproponuj pobranie.

## Definition of Done
- Lista dostępnych wersji Java jest pobierana z API Adoptium.
- Wybrana wersja JRE jest pobierana i wypakowywana do lokalnego katalogu.
- Po pobraniu `java -version` weryfikuje poprawność.
- UI pokazuje status Java dla każdej wersji.
- Auto-detect przy tworzeniu instancji działa.
