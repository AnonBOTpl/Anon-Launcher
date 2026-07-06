# TASK-01 — Inicjalizacja projektu Tauri + React + TypeScript

## Cel
Stworzenie szkieletu projektu Tauri v2 z frontendem React i TypeScript, wraz z podstawową konfiguracją build systemu oraz strukturą katalogów.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `.gitignore`

## Zależności
Brak

## Szczegóły implementacji
1. Zainicjuj projekt przy użyciu `npm create tauri-app` z szablonem React + TypeScript (Tauri v2).
2. Skonfiguruj `vite.config.ts` z aliasem `@/` dla katalogu `src/`.
3. Skonfiguruj `tsconfig.json` z strict mode i ścieżkami zgodnymi z aliasem Vite.
4. Utwórz strukturę katalogów: `src/`, `src/components/`, `src/lib/`, `src/pages/`, `src/hooks/`, `src/types/`.
5. Skonfiguruj `src-tauri/tauri.conf.json` z podstawowymi identyfikatorami aplikacji, nazwą okna i rozmiarami.
6. Dodaj podstawowy `lib.rs` z komendą `greet` do weryfikacji komunikacji Rust ↔ Frontend.
7. Utwórz `.gitignore` dla Node, Rust i Tauri artefaktów.
8. Zainstaluj zależności npm i zweryfikuj że `npm run tauri dev` uruchamia się bez błędów.

## Definition of Done
- `npm run tauri dev` uruchamia aplikację z pustym oknem i działającą komendą `greet`.
- Struktura katalogów odzwierciedla powyższe wymagania.
- Alias `@/` działa w importach TypeScript.
- Projekt jest gotowy do dodawania kolejnych zależności.
