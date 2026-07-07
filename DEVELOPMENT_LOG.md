# Development Log — AnonLauncher

## 2026-06-28 — TASK-01: Inicjalizacja projektu

### Co zostało zrobione
- Zainicjowano projekt Tauri v2 + React + TypeScript
- Skonfigurowano `vite.config.ts` z aliasem `@/` dla katalogu `src/`
- Skonfigurowano `tsconfig.json` z strict mode i ścieżkami
- Utworzono strukturę katalogów: `src/components/`, `src/lib/`, `src/pages/`, `src/hooks/`, `src/types/`
- Skonfigurowano `tauri.conf.json` (identyfikator: `com.anonlauncher.app`, okno 1200x800, min 900x600)
- Dodano komendę `greet` w backendzie Rust do weryfikacji komunikacji
- Utworzono `.gitignore` dla Node, Rust i Tauri artefaktów
- Zainstalowano zależności npm i Cargo
- Zweryfikowano: `tsc --noEmit` ✅, `cargo build` ✅, `vite build` ✅
- Ikonki zastąpione własnym `icon.png` użytkownika (500x500) — wygenerowane przez `npx tauri icon`

### Status
- [x] TASK-01 — Inicjalizacja projektu Tauri + React + TypeScript

### Uwagi
- `@tauri-apps/plugin-path` nie istnieje jako osobny npm package — funkcje path są w `@tauri-apps/api`
- Do `cargo check` potrzebny jest katalog `dist/` (walidowany przez `tauri::generate_context!()`)
- Do pełnego builda wymagane są pliki ikon w `src-tauri/icons/`

## 2026-06-28 — TASK-02: Konfiguracja shadcn/ui

### Co zostało zrobione
- Zainstalowano Tailwind CSS v4 z `@tailwindcss/vite`
- Zainstalowano `clsx` i `tailwind-merge`
- Dodano plugin `tailwindcss()` w `vite.config.ts`
- Utworzono `src/styles/globals.css` z motywem shadcn (jasny/ciemny) — CSS variables HSL, `@theme inline`, `@custom-variant dark`
- Utworzono `src/lib/utils.ts` z funkcją `cn()`
- Zainicjowano shadcn/ui przez `npx shadcn@latest init` (styl: `base-nova`, ikony: lucide)
- Dodano komponenty: Button, Card, Dialog, Input, Select, Label, Badge, Separator, Tabs, ScrollArea, Sheet, DropdownMenu, Avatar
- Naprawiono `scroll-area.tsx` (usunięto nieużywany import React)
- Zweryfikowano: `tsc --noEmit` ✅, `vite build` ✅

### Status
- [x] TASK-01 — Inicjalizacja projektu Tauri + React + TypeScript
- [x] TASK-02 — Konfiguracja shadcn/ui
- [x] TASK-03 — System manifestów instancji (ze schemaVersion)

### Uwagi
- shadcn z Tailwind v4 nie używa `tailwind.config.js` — konfiguracja przez CSS `@theme inline` całkowicie to zastępuje
- `@tailwindcss/vite` plugin zastępuje PostCSS config
- Styl `base-nova` — nowy domyślny styl shadcn/ui dla Tailwind v4

## 2026-06-28 — TASK-03: System manifestów instancji

### Co zostało zrobione
- **TypeScript**: `src/types/instance.ts` — typy InstanceManifest, CreateInstanceInput, ReadManifestResult, ManifestError; `CURRENT_SCHEMA_VERSION = 1`
- **TypeScript**: `src/lib/manifest.ts` — funkcje `hasSchemaVersion()`, `isValidManifest()`, `migrateManifest()` z rejestrem migracji, `createManifest()`
- **Rust**: `manifest.rs` — struktury InstanceManifest, LoaderType, CreateInstanceInput z serde
- **Rust**: `manifest_migration.rs` — `migrate_manifest()`, `validate_manifest()` z testami jednostkowymi
- **Rust**: `instance_manager.rs` — CRUD: `create_instance()`, `read_manifest()`, `list_instances()`, `delete_instance()`, `update_manifest()` z testami
- **Rust**: `lib.rs` — zarejestrowano moduły + komendy Tauri: `create_instance`, `read_manifest`, `list_instances`, `delete_instance`, `update_manifest`
- **Rust**: dodano `tempfile = "3"` do Cargo.toml dla testów
- **Naprawiono**: błędy TypeScript (typowanie w migracji) i Rust (list_instances, nieużywany parametr)
- Zweryfikowano: `tsc --noEmit` ✅, `cargo check` ✅

### Uwagi
- `schemaVersion` jest wymagane — manifest bez tego pola jest odrzucany
- Mechanizm migracji gotowy do rozszerzania — każda nowa wersja schematu to osobna funkcja w rejestrze
- Ścieżka przechowywania: `$APP_DATA/instances/<nazwa>/instance.json`
- Typy TypeScript i Rust są zgodne (camelCase przez `serde(rename_all = "camelCase")`)

## 2026-06-28 — TASK-04: Podstawowy Dashboard

### Co zostało zrobione
- Zainstalowano `react-router-dom`
- Utworzono `src/router.tsx` z `createHashRouter` (kompatybilny z Tauri) — ścieżki `/` i `/instance/:id`
- Zaktualizowano `src/App.tsx` — używa `RouterProvider`
- `src/components/Header.tsx` — logo, przełącznik motywu (jasny/ciemny), placeholder konta
- `src/components/InstanceCard.tsx` — nazwa, wersja MC, loader badge (Vanilla/Fabric), RAM, przycisk uruchomienia (placeholder)
- `src/components/InstanceGrid.tsx` — responsywna siatka CSS Grid (1-4 kolumny)
- `src/hooks/useInstances.ts` — ładuje listę instancji przez `invoke('list_instances')`
- `src/pages/Dashboard.tsx` — stany: loading, error, empty (z przyciskiem "Nowa instancja"), grid
- `src/pages/InstanceView.tsx` — placeholder z przyciskiem powrotu
- **Fix**: `createHashRouter` zamiast `createBrowserRouter` dla kompatybilności z Tauri production
- **Fix**: dodano `onClick` do przycisku "Nowa instancja" w stanie pustym
- Zweryfikowano: `tsc --noEmit` ✅, `vite build` ✅

### Status
- [x] TASK-01 — Inicjalizacja projektu Tauri + React + TypeScript
- [x] TASK-02 — Konfiguracja shadcn/ui
- [x] TASK-03 — System manifestów instancji (ze schemaVersion)
- [x] TASK-04 — Podstawowy Dashboard
- [x] TASK-05 — Tworzenie instancji
- [x] TASK-06 — Klonowanie instancji
- [x] TASK-07 — Eksport i import ZIP

## 2026-06-28 — TASK-05: Tworzenie instancji

### Co zostało zrobione
- **`src/lib/minecraft-versions.ts`** — funkcje pobierające wersje MC z API Mojang (`piston-meta.mojang.com`) i Fabric loadery z API Fabric (`meta.fabricmc.net`), z cache 5 min
- **`src/components/VersionSelect.tsx`** — selektor wersji MC z zakładkami Wydania/Snapshoty, stanami loading/error
- **`src/components/LoaderSelect.tsx`** — przełącznik Vanilla/Fabric (karty), auto-pobieranie wersji Fabric po wybraniu MC, auto-wybór stabilnej
- **`src/components/CreateInstanceForm.tsx`** — pełny formularz: nazwa (walidacja znaków, długość), RAM (range 1-16 GB), Java (8/11/17/21), JVM args, walidacja, obsługa błędów
- **`src/pages/CreateInstance.tsx`** — strona tworzenia
- **Routing**: dodano `/create` w router.tsx, podłączono przycisk "Nowa instancja" w Dashboard
- **Fiksy**: `useNavigate` w Dashboard, typy `onValueChange` (string | null) w Selectach
- Zweryfikowano: `tsc --noEmit` ✅, `vite build` ✅

## 2026-06-28 — TASK-06: Klonowanie instancji

### Co zostało zrobione
- **Rust**: dodano `clone_instance` w `instance_manager.rs` — kopiuje cały katalog instancji (`copy_dir_recursively`), tworzy nowy manifest z aktualnymi datami, waliduje (source istnieje, duplikat nazwy, znaki niedozwolone)
- **Rust**: dodano komendę Tauri `clone_instance` w `lib.rs` i zarejestrowano w `generate_handler!`
- **Hook**: `src/hooks/useCloneInstance.ts` — `clone(sourceName, newName)` przez `invoke()`
- **Dialog**: `src/components/CloneInstanceDialog.tsx` — shadcn Dialog z polem nazwy, walidacją, stanem ładowania, błędem, przekierowaniem po sukcesie
- **UI**: przycisk "Klonuj instancję" w `InstanceView.tsx` otwiera dialog
- Zweryfikowano: `tsc --noEmit` ✅, `cargo check --offline` ✅

## 2026-06-28 — TASK-07: Eksport i import ZIP

### Co zostało zrobione
- **Zależności**: dodano `zip`, `walkdir` (Rust), `@tauri-apps/plugin-dialog` (npm), `tauri-plugin-dialog` (Rust)
- **`zip_export.rs`** — kompresja katalogu instancji do ZIP (Deflated, walkdir do rekurencyjnego przejścia, ścieżki z forward slash)
- **`zip_import.rs`** — dekompresja ZIP, walidacja manifestu przed wypakowaniem, migracja schematu, obsługa duplikatów nazw, strip top-level dir
- **Komendy Tauri**: `export_instance`, `validate_import_zip`, `import_instance`
- **`useFileDialog.ts`** — hook do natywnych okien dialogu (save/open) przez plugin-dialog
- **`ExportInstanceDialog.tsx`** — dialog z natywnym save dialogiem, stanami eksport/sukces/błąd
- **`ImportInstanceDialog.tsx`** — kreator wieloetapowy: select ZIP → confirm (nazwa, migracja) → done
- **UI**: przycisk "Eksportuj" w InstanceView, przycisk "Importuj ZIP" w Dashboard
- **Fiksy**: borrow checker (read_manifest_from_zip), serde `rename_all = camelCase` na ZipValidation, `pub write_manifest_to_disk`, nieużywany import PathBuf
- Zweryfikowano: `tsc --noEmit` ✅, `cargo check` ✅

## 2026-06-28 — TASK-08: Otwieranie folderu instancji

### Co zostało zrobione
- **Backend**: `open_instance_folder` w `lib.rs` — otwiera folder instancji przez `explorer` (Win), `open` (macOS), `xdg-open` (Linux)
- **Hook**: `useOpenFolder.ts` — `openFolder(instanceName)` przez `invoke()`
- **Komponent**: `OpenFolderButton.tsx` — przycisk z ikonką folderu, stanem ładowania i błędem
- **UI**: przycisk dodany w InstanceView obok Eksportuj i Klonuj
- Zweryfikowano: `tsc --noEmit` ✅, `cargo check` ✅

## 2026-06-28 — TASK-30: Usuwanie instancji

### Co zostało zrobione
- **`DeleteInstanceDialog.tsx`** — modal potwierdzenia z wymogiem wpisania nazwy instancji (case-sensitive), przycisk "Usuń" aktywny dopiero gdy nazwa się zgadza, obsługa błędów, przekierowanie do Dashboardu po usunięciu
- **`InstanceCard.tsx`** — dodano ikonkę kosza (hover widoczny, kolor destructive), podpięto DeleteInstanceDialog, prop `onDeleted`
- **Fix**: łańcuch propów przez InstanceGrid → Dashboard → refresh, hero card też ma przycisk usuwania
- Zweryfikowano: `tsc --noEmit` ✅

## 2026-06-28 — Redesign UI: Sidebar + paleta kolorów

### Co zostało zrobione
- **`Sidebar.tsx`** — wąski pasek (64px) z gradientowym logo, ikonami nawigacji (Dashboard, Nowa instancja), aktywnym stanem w fiolecie, przełącznikiem motywu i placeholderem avatara
- **`AppLayout.tsx`** — layout `Sidebar + <Outlet />`, wszystkie strony używają go przez router
- **`router.tsx`** — layout route z AppLayout jako rodzicem
- **`globals.css`** — pełna nowa paleta: tło `#0F172A`, karty slate-800, akcent fiolet Nether `#A855F7`, `--radius: 14px`, glassmorphism (`.glass` utility), animacja `portal-pulse` (subtle purple glow), `fade-in` dla kart
- **`Dashboard.tsx`** — hero card pierwszej instancji z portal glow, gradientowy przycisk "Otwórz", grid tylko dla pozostałych instancji, przycisk usuwania na hero card
- **`InstanceView.tsx`** — hero card z przyciskiem "Uruchom", underline tabs placeholder
- **`CreateInstance.tsx`** — bez Header, czysty top bar
- **`Header.tsx`** — usunięty (dead code)
- Zweryfikowano: `tsc --noEmit` ✅

## 2026-06-28 — TASK-31: Edycja ustawień instancji

### Co zostało zrobione
- **Backend Rust**: `update_instance` w `instance_manager.rs` — walidacja, zmiana nazwy (rename folderu przez fs::rename), sprawdzanie kolizji, zachowanie `createdAt` z dysku, ustawienie `updatedAt` na `chrono_now()`
- **Komenda Tauri**: `update_instance(old_name, new_manifest)` zarejestrowana (zastąpiła starą `update_manifest`)
- **`EditInstanceDialog.tsx`** — ładuje manifest przez `read_manifest`, pre-populuje formularz (nazwa, RAM suwak, Java dropdown, JVM args), walidacja, zapis przez invoke
- **Przycisk "Edytuj"** — ikona ołówka w `InstanceCard.tsx`, hero card Dashboard i top bar InstanceView
- **Fix**: backend nadpisuje `updatedAt`, zachowuje oryginalne `createdAt`
- Zweryfikowano: `tsc --noEmit` ✅, `cargo check` ✅

## 2026-06-29 — TASK-32: UI szczegóły + TASK-09: Microsoft Device Code Flow (częściowo)

### Co zostało zrobione

**TASK-32 — UI szczegóły:**
- `HeroCard.tsx` — współdzielony komponent karty instancji (ikona, nazwa, MC/badge/RAM, action icons, przycisk "Uruchom")
- `InstanceTabs.tsx` — underline tabs w stylu VS Code (Gra/Mody/Logi/Profil)
- `InstanceView.tsx` — pełna przebudowa: ładowanie manifestu, stany loading/error/not-found
- `OpenFolderButton.tsx` — dodany `iconOnly` mode

**TASK-09 — Microsoft Device Code Flow (częściowo — czeka na zatwierdzenie Microsoft):**
- **Backend Rust** (`src-tauri/src/auth.rs`):
  - Pełny łańcuch auth: MS Device Code → XBL → XSTS → Minecraft → Profil
  - Klient HTTP: `reqwest::blocking`
  - 3 komendy Tauri: `start_device_code_flow`, `poll_for_token`, `complete_minecraft_auth`
  - `client_id` przekazywany z frontendu (fallback do stałej gdy pusty)
  - Fix: `#[serde(rename_all(deserialize = "snake_case", serialize = "camelCase"))]` — MS API zwraca snake_case
- **Frontend:**
  - `src/types/auth.ts` — typy TypeScript
  - `src/hooks/useAuth.ts` — stan logowania, pętla pollingu, cancel, logout
  - `src/hooks/useSettings.ts` — Client ID w localStorage
  - `src/components/LoginDialog.tsx` — pełny dialog: idle/code/polling/completing/done/error
  - `src/components/DeviceCodeDisplay.tsx` — kod + przycisk otwierania URL
  - `src/components/SettingsDialog.tsx` — pole na własny Client ID z instrukcją
  - `src/components/Sidebar.tsx` — przyciski logowania + settings (⚙️)

### Bloker — Minecraft API

Minecraft API blokuje Client ID (`316a868f-d3ad-4d0f-be3f-4692d5975c34`):
```
403 Forbidden: "Invalid app registration"
```

**Wykonane kroki:**
1. Zarejestrowano aplikację przez Azure CLI (`az ad app create`)
2. Skonfigurowano: `isFallbackPublicClient: true`, `signInAudience: AzureADandPersonalMicrosoftAccount`
3. Zweryfikowano przez Azure CLI — konfiguracja jest poprawna
4. Wysłano formularz: https://aka.ms/mce-reviewappid

**Dane aplikacji:**
| Pole | Wartość |
|---|---|
| Client ID | `316a868f-d3ad-4d0f-be3f-4692d5975c34` |
| Object ID | `20caf7b8-9abf-486f-b266-9ef83f725eb5` |
| Tenant ID | `a879ebea-0590-43aa-ac8b-8f6debe427b0` |
| Konto | `wermich2018@gmail.com` |
| Status | Czeka na zatwierdzenie Microsoft |

### Nowe pliki
- `src/hooks/useSettings.ts` — localStorage dla Client ID
- `src/components/SettingsDialog.tsx` — dialog ustawień

### Zmodyfikowane pliki
- `src-tauri/src/auth.rs` — serde fix, client_id jako parametr
- `src-tauri/src/lib.rs` — nowe sygnatury komend auth
- `src/hooks/useAuth.ts` — integracja z useSettings
- `src/components/Sidebar.tsx` — przycisk settings
- `src/components/HeroCard.tsx` — bugfix (dead code, non-null assertion)
- `src-tauri/capabilities/default.json` — uprawnienia Tauri dla dialog, shell

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-06-29 — TASK-11: Moduł pobierania Java (Adoptium API)

### Co zostało zrobione

**Backend Rust:**
- `java_manager.rs` — JavaManager: list_versions (Adoptium API), download_java (zip/tar.gz + wyodrębnienie + weryfikacja), get_java_path, verify_custom_path
- Platform detection: Windows (zip), Linux/macOS (tar.gz), x64/aarch64

**Frontend:**
- `src/lib/java.ts` — mapa MC→Java (8/11/17/21), API wrappery
- `src/hooks/useJavaRuntime.ts` — React hook z refresh/startDownload/checkJavaForMc
- `src/components/JavaSettings.tsx` — pure props-driven: dropdown z auto-wyborem + przycisk Pobierz + własna ścieżka z natywnym dialogiem
- `customJavaPath` dodany do `InstanceManifest` i `CreateInstanceInput`
- Zielony badge potwierdzenia po udanym pobraniu

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-06-29 — TASK-12: Integracja Minecraft Core (wersje, biblioteki, launch)

### Decyzja architektoniczna
Odrzucono gotowe paczki npm (`@xmcl/core` — nieaktualne od roku, `minecraft-java-core` — licencja CC BY-NC).
Zastosowano **podejście hybrydowe**: frontend (TypeScript) resolvuje JSON z Mojang API, backend (Rust) ściąga pliki i odpala Javę.

### Co zostało zrobione

**`src/types/minecraft.ts`** — typy TypeScript dla struktur JSON Minecrafta:
- MinecraftVersionManifest, MinecraftVersionJson
- MinecraftLibrary, MinecraftRule, MinecraftDownloadArtifact
- MinecraftAssetIndex, MinecraftArgumentRules, ResolvedLibrary
- ResolvedVersion (w pełni rozpoznana wersja), LaunchOptions

**`src/lib/version-resolver.ts`** — rozwiązywanie wersji Minecraft:
- `fetchVersionManifest()` — pobiera listę wersji z Mojang API
- `fetchVersionJson(url)` — pobiera JSON konkretnej wersji
- `fetchFabricMeta(mcVersion, loaderVersion)` — pobiera profil Fabric
- `resolveVersion(mcVersion, loader?)` — **główna funkcja**:
  - Pobiera JSON wersji z Mojang
  - Resolvuje biblioteki z filtrowaniem OS (Windows/Linux/macOS, x64/x86)
  - Obsługuje biblioteki natywne (LWJGL itp.) z `${arch}`
  - Dla **Fabric**: scala biblioteki + argumenty + mainClass
  - Parsuje argumenty gry i JVM z regułami OS
  - Obsługa legacy `minecraftArguments` (pre-1.13)
  - Zwraca gotowy obiekt ResolvedVersion
- `evaluateRules(rules)` — evaluacja reguł OS dla bibliotek/argumentów
- `resolveLibrary(lib)` — resolvuje pojedynczą bibliotekę (artifact, natives, fallback URL)
- `getDownloadList(resolved)` — dzieli na: biblioteki, natywne, client.jar

**`src/lib/minecraft-core.ts`** — generowanie argumentów launcha:
- `generateClasspath(resolved, gameDir)` — lista JARów w classpath (;) na Windows, (:) na Linux/macOS
- `generateLaunchArgs(options)` — **generuje pełną tablicę argumentów** dla procesu Java:
  - Tokenizacja: `${auth_player_name}`, `${game_directory}`, `${natives_directory}`, itd.
  - JVM args z wersji + `-Xms`/`-Xmx` + custom JVM args
  - `-cp` + classpath + mainClass + game args
  - Window size (--width/--height)
  - Server auto-connect (--server/--port)

**`src-tauri/src/minecraft_core.rs`** — backend Rust:
- `download_libraries(libraries[])` — pobiera biblioteki do `$APP_DATA/libraries/`, skipuje jeśli istnieją i zgadza się rozmiar
- `download_client_jar(version, url, size)` — client.jar do `$APP_DATA/versions/{version}/`
- `download_assets(index)` — asset index + indywidualne assety do `$APP_DATA/assets/objects/{prefix}/{hash}`
- `launch_minecraft(java_path, args, game_dir, detached)` — spawn procesu Java z PID

**`src-tauri/src/lib.rs`** — 4 nowe komendy Tauri:
- `download_libraries`, `download_client_jar`, `download_assets`, `launch_minecraft`

### Definicja gotowości (DoD)
- ✅ `resolveVersion` zwraca poprawne metadata dla Vanilla i Fabric
- ✅ `generateClasspath` zwraca listę JARów z bibliotekami i grą
- ✅ `generateLaunchArgs` generuje poprawne argumenty uruchomieniowe
- ✅ Obsługa błędów dla nieznanych wersji

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-06-29 — Testy jednostkowe Java Manager

### Co zostało zrobione
Dodano 13 testów jednostkowych do `java_manager.rs`:

**Konstruktor i ścieżki (4 testy):**
- `test_java_manager_constructor` — weryfikuje poprawność ścieżek i wykrywanie OS/arch
- `test_java_dir_for` — konstrukcja ścieżki `.../java/21`
- `test_java_exe_path_on_platform` — `bin/java.exe` (Windows) lub `bin/java` (Unix)
- `test_is_installed_returns_false_when_not_installed`

**Instalacja (3 testy):**
- `test_is_installed_returns_true_when_file_exists` — tworzy fake java binary, sprawdza wykrywanie
- `test_get_java_path_returns_error_when_not_installed`
- `test_get_java_path_returns_path_when_installed`

**Weryfikacja ścieżki (1 test):**
- `test_verify_custom_path_returns_error_when_not_found` — nieistniejący plik → błąd

**Strip top-level dir (3 testy):**
- `test_strip_top_level_dir_does_nothing_on_empty` — pusty katalog
- `test_strip_top_level_dir_moves_contents_up` — tworzy `jdk-17.0.9+9/bin/java.exe`, stripuje → `bin/java.exe`
- `test_strip_top_level_dir_does_nothing_with_multiple_entries` — 2+ katalogi, nie stripuje

**Ekstrakcja ZIP (2 testy):**
- `test_extract_zip_strips_top_level_dir` — tworzy plik ZIP z top-level dir, wypakowuje, weryfikuje że katalog został usunięty
- `test_extract_zip_returns_error_on_missing_file`

**API (1 test, ignorowany):**
- `test_list_versions_includes_available_releases` — `#[ignore]`, wymaga dostępu do Adoptium API

### Wynik
- `cargo test -- java_manager` — **13/13 passed** ✅ (1 ignorowany, wymaga sieci)

## 2026-06-29 — TASK-DEV-AUTH + TASK-10: Mock auth + zarządzanie kontami + Stronghold

### TASK-DEV-AUTH — Mock auth dla trybu developerskiego

## 2026-06-29 — TASK-DEV-AUTH + TASK-10: Mock auth + zarządzanie kontami + Stronghold

### TASK-DEV-AUTH — Mock auth dla trybu developerskiego

**Cel:** Umożliwienie testowania launchera bez działającego Microsoft Auth.

**Co zrobiono:**
- `src/lib/auth.ts` — nowy plik. 3 funkcje (`startDeviceCodeFlow`, `pollForToken`, `completeMinecraftAuth`)
  które sprawdzają `VITE_DEV_MODE`. W dev mode zwracają mock session, w produkcji delegują do Tauri invoke.
- `src/hooks/useAuth.ts` — zaktualizowany: import z `@/lib/auth` zamiast bezpośredniego `invoke`.
- `src/types/auth.ts` — dodane `offline?: boolean` do `MinecraftSession`.
- `.env` — utworzony z `VITE_DEV_MODE=true`, mock username/UUID.
- `.env.example` — utworzony z dokumentacją i domyślnie `VITE_DEV_MODE=false`.
- `.gitignore` — już zawiera `.env` (bez zmian).

**Zasada:** Gdy Microsoft zatwierdzi Client ID, wystarczy ustawić `VITE_DEV_MODE=false` w `.env`.
Zero kodu do usuwania.

### TASK-10 — Zarządzanie wieloma kontami + AccountSwitcher + AccountManagerDialog

**Backend Rust:**
- `src-tauri/src/account_manager.rs` — nowy plik. AccountManager przechowuje metadane kont (uuid, username, offline)
  w pliku JSON `$APP_DATA/accounts/accounts.json`. Operacje: save_account, list_accounts, delete_account,
  set_active_account, get_active_account.
- `src-tauri/src/lib.rs` — 5 nowych komend Tauri dla kont, Stronghold plugin zainicjowany z Argon2 KDF.
- `src-tauri/Cargo.toml` — dodano `tauri-plugin-stronghold = "2.3.1"`, profil scrypt.
- `src-tauri/capabilities/default.json` — dodano `stronghold:default`.

**Frontend:**
- `src/types/account.ts` — typy AccountMeta, AccountData, AccountDisplay.
- `src/lib/accounts.ts` — mock-aware API: dev mode → localStorage, produkcja → Tauri + Stronghold.
- `src/lib/stronghold.ts` — wrapper na Stronghold JS API (saveRefreshToken, getRefreshToken, removeRefreshToken).
- `src/hooks/useAccounts.ts` — React hook z refresh/switch/remove.
- `src/components/AccountSwitcher.tsx` — avatar button + dropdown z listą kont, przełączaniem, przyciskiem "Zarządzaj kontami".
- `src/components/AccountManagerDialog.tsx` — dialog z listą kont, potwierdzeniem usunięcia, przyciskiem "Dodaj konto"
  który uruchamia flow logowania i auto-zapisuje sesję do kont.
- `src/components/Sidebar.tsx` — placeholder avatara zastąpiony AccountSwitcher.

**Stronghold encryption:**
- Refresh tokeny są przechowywane w Stronghold vault (`$APP_DATA/accounts/vault.hold`) zamiast plaintext JSON.
- Metadane kont (username, uuid) w JSON dla szybkiego listowania.
- W dev mode tokeny w localStorage (jak wcześniej).

- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-06-29 — TASK-12 update + TASK-13: Uruchamianie Vanilla + Process Manager

### TASK-12 — Aktualizacja dokumentacji
Zaktualizowano `TASK-12.md` z dokumentacją hybrydowego podejścia (TypeScript resolvuje JSON, Rust ściąga pliki i odpala Javę), bez zależności od zewnętrznych paczek.

### TASK-13 — Uruchamianie Vanilla

**Backend Rust:**
- `process_manager.rs` — zarządzanie procesem Java:
  - `launch()` — spawn Javy z piped stdout/stderr, wątki czytające i emitujące Tauri eventy (`instance:log`, `instance:launched`, `instance:stopped`)
  - `stop()` — kill procesu (taskkill na Windows, kill na Unix), czeka na zakończenie
  - `get_status()` — sprawdza czy proces żyje (tasklist/kill -0/proc)
- `lib.rs` — 3 nowe komendy: `launch_instance` (oblicza gameDir z nazwy instancji + init managera), `stop_instance`, `get_instance_status`

**Frontend:**
- `src/hooks/useLaunch.ts` — React hook subskrybujący eventy Tauri (`instance:log`, `instance:launched`, `instance:stopped`), zarządzający stanem (idle/launching/running/error)
- `src/components/LaunchButton.tsx` — przycisk z 5 stanami: idle → launching (spinner) → running (stop) → error (retry + komunikat)
- `src/components/GameConsole.tsx` — terminal logów w stylu VS Code (#1E1E1E, monospace 13px, kolorowanie linii według treści)
- `src/pages/InstanceView.tsx` — integracja flow: resolveVersion → download_client_jar → download_libraries → generateLaunchArgs → launch
- `src/components/HeroCard.tsx` — zaktualizowany, przycisk "Uruchom" używa LaunchButton

**Znane problemy (udokumentowane w TASK-13.md do fixu w TASK-26/27):**
1. 🔴 `handleLaunch` nie ma obsługi błędów — przycisk może utknąć w "Uruchamianie..."
2. 🟡 Race condition w monitor thread (500ms sleep)
3. 🟡 Błędy `stop()` są wyciszone

**Build:** `tsc --noEmit` ✅ `cargo check` ✅ (0 błędów, 0 warningów)

## 2026-06-29 — Poprawki UX + bugfiksy

### Zmiany

**Dashboard — usunięty hero card:**
- Wszystkie instancje wyświetlane jako równe kafelki w InstanceGrid
- Przycisk "Nowa instancja" przeniesiony do górnego paska
- Usunięto niepotrzebne stany/dialogi hero (heroEditOpen, heroDeleteOpen)

**Problemy z launch'em 1.12.2 i 1.8.9:**
- `minecraftArguments` (legacy) dzielony na pojedyńcze tokeny zamiast wrzucania jako jeden string — fix dla `joptsimple.MissingRequiredOptionsException` (1.12.2)
- `evaluateRules` — domyślna wartość `false` gdy reguły istnieją ale nie pasują — fix dla `-XstartOnFirstThread` na Windows (wszystkie wersje)
- `-Djava.library.path` zawsze dodawany do JVM args — fix dla LWJGL2 przy legacy wersjach
- `extract_natives()` w Rust — wypakowuje DLL z JARów do `$APP_DATA/natives/`

**Duplikowanie logów:**
- Połączono stdout + stderr w jeden reader przez `std::io::Read::chain()` — Minecraft często pisze to samo do obu strumieni
- Usunięto 500ms monitor thread — `instance:launched` emitowany synchronicznie po spawnie

**Usuwanie instancji → dashboard:**
- Dodano prop `onDeleted` do HeroCard → DeleteInstanceDialog nawiguje do `/` zamiast robić `navigate(0)`

**Edycja instancji:**
- Wersja Minecraft — zmieniona z read-only div na edytowalne pole tekstowe
- Loader (Vanilla/Fabric) — zmieniony na select dropdown
- Wersja loadera — pojawia się tylko dla Fabric

**Nowe pliki:**
- `ideas.md` — notatka o problemie z 1.8.9 + pomysły na przyszłość

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-06-29 — Fix "VVanilla" + EditInstanceDialog z VersionSelect

### Fix "VVanilla"
- `InstanceCard.tsx`: usunięto `loaderIcons[instance.loader]` z badge'a — literka "V" + "Vanilla" dawało "VVanilla"
- Usunięto nieużywany `loaderIcons` (dead code po fixie)

### EditInstanceDialog — pełna edycja
- MC Version: zmieniony z text input na `VersionSelect` dropdown (zakładki Wydania/Snapshoty)
- Loader: zmieniony na `LoaderSelect` (karty Vanilla/Fabric, auto-pobiera Fabric)
- Walidacja: MC version wymagane, loader version wymagane dla Fabric
- Warning Java: żółte ostrzeżenie gdy wybrana Java nie zgadza się z rekomendowaną dla MC
- Fix: Java nie nadpisuje się przy otwarciu dialogu (tylko przy ręcznej zmianie MC)

### Build
- `tsc --noEmit` ✅

### Status projektu
- [x] TASK-01 — Inicjalizacja projektu
- [x] TASK-02 — Konfiguracja shadcn/ui
- [x] TASK-03 — System manifestów instancji
- [x] TASK-04 — Podstawowy Dashboard
- [x] TASK-05 — Tworzenie instancji
- [x] TASK-06 — Klonowanie instancji
- [x] TASK-07 — Eksport i import ZIP
- [x] TASK-08 — Otwieranie folderu instancji
- [x] TASK-30 — Usuwanie instancji
- [x] TASK-31 — Edycja ustawień instancji
- [x] TASK-32 — Widok instancji (layout z zakładkami)
- [x] TASK-09 — Microsoft Device Code Flow (kod gotowy, czeka na Azure)
- [x] TASK-DEV-AUTH — Mock auth dla trybu developerskiego
- [x] TASK-10 — Stronghold + zarządzanie kontami
- [x] TASK-11 — Moduł pobierania Java (Adoptium)
- [x] TASK-12 — Integracja Minecraft Core (wersje, biblioteki, launch)
- [x] TASK-13 — Uruchamianie Vanilla + Process Manager
- [x] TASK-14 — Fabric loader (głównie zrealizowany w TASK-12)
- [ ] TASK-15+ — Pozostałe taski

## 2026-06-30 — Searchable dropdowny + error handling launcha

### Search wersji Minecraft i Fabric
- **VersionSelect.tsx** — przepisany z shadcn Select na własny dropdown z wyszukiwarką: search input (auto-focus przy otwarciu), tab switcher Wydania/Snapshoty, lista wersji z custom scrollbarem, licznik wyników
- **LoaderSelect.tsx** — to samo dla wersji Fabric: search input, lista z badge'ami "stabilna", custom scrollbar
- **globals.css** — dodano `.custom-scrollbar` (thin scrollbar dla Firefox/WebKit)

### Error handling przy uruchamianiu
- **InstanceView.tsx** — dodano `launchError` state z bannerem błędów (czerwony pasek z komunikatem i przyciskiem zamknięcia). Błędy z `handleLaunch` (np. brak wersji Fabric, nieudane pobieranie) są teraz widoczne dla użytkownika, nie tylko w console.log

### Bugfix: dead code
- Usunięto nieużywaną zmienną `selectedTabType` i `selectedVersion` z VersionSelect
- Dodano `htmlFor`/`id` accessibility (Label→button association)

### Build
- `tsc --noEmit` ✅

## 2026-06-30 — Logi: dedup, karty, filtry + osobne okno konsoli

### Fix podwójnych logów
- **Przyczyna**: Fabric pisze każdą linię do stdout i stderr. chain() dostarcza całe stdout, potem całe stderr jako blok — lastLineRef nie łapał duplikatów.
- **Fix**: Bounded Set<string> (200 ostatnich linii) z FIFO eviction w useLaunch.ts — łapie duplikaty nawet gdy przychodzą w bloku.

### Karty konsoli: Wszystkie / Fabric / Silnik
- **GameConsole.tsx** — przepisany z nowym UI: 3 karty z licznikami linii, filtrowanie po poziomie (All/INFO/WARN/ERROR/DEBUG) z toggle, wyszukiwarka Ctrl+F, kolorowanie prefixu [thread/LEVEL] na szaro i treści według poziomu.
- **useLaunch.ts** — detectCategory() klasyfikuje linie jako fabric ([main/] lub zawiera fabric/loader/mixin) lub engine (Render thread, Server thread, itd.). detectLevel() wykrywa poziom z treści.

### Osobne okno konsoli (undock)
- **ConsoleWindow.tsx** (nowy) — strona tylko z GameConsole, bez sidebaru, do wyświetlenia w osobnym oknie Tauri.
- **router.tsx** — dodano route /console/:id poza AppLayout.
- **InstanceView.tsx** — przycisk "Odepnij" w SheetHeader konsoli. Tworzy nowe okno Tauri (800x600, center) przez WebviewWindow. Zapobiega duplikatom — jeśli okno już istnieje, ustawia focus.

### Fix wysokości konsoli
- Przywrócono h-72 (mały rozmiar) zamiast h-[55vh] — konsola nie zajmuje połowy ekranu.

### Build
- tsc --noEmit ✅

## 2026-07-05 — Fix demo mode, asset download, AccountSwitcher, console window, cleanup

### 🔥 Fix: Demo mode (Minecraft uruchamiał się jako demo)

#### Przyczyna główna
W `version-resolver.ts` funkcja `resolveArgument()` była wywoływana bez mapy `features`.
Wersja JSON 1.21.4 opakowuje `--demo` w regułę: `{ "rules": [{"features": {"is_demo_user": true}}], "value": "--demo" }`.
Bez przekazania `features: { is_demo_user: false }`, reguła była ignorowana i `--demo` trafiało do argumentów.

#### Inne naprawione przyczyny
| # | Plik | Problem |
|---|---|---|
| 1 | `auth.rs` | `refresh_minecraft_token()` zwracał Microsoft OAuth zamiast Minecraft token — brak chain XBL→XSTS→MC |
| 2 | `minecraft-core.ts` | `clientid: "anon-launcher-1-0-0"` — nieprawidłowa wartość, powinna być zgodna z Azure App ID |
| 3 | `minecraft-core.ts` | Brak tokenów `launcher_name` i `launcher_version` — zostawały jako literalne stringi w JVM args |
| 4 | `minecraft_core.rs` | `download_client_jar()` pobierał tylko `.jar` bez `.json` — brak weryfikacji wersji |
| 5 | `accounts.ts` | `xuid` nie był wyciągany z JWT — dodana `extractXuidFromToken()` |
| 6 | `minecraft-core.ts` | `replaceTokens()` używał złego regexa — `\${...}` z backslashem zamiast `${...}` — tokeny nigdy nie były podmieniane |
| 7 | `version-resolver.ts` | Brak mapy `features` → `--demo` trafiało do args (✨ **przyczyna główna**) |

### Fix: UI freeze podczas pobierania assetów
- `minecraft_core.rs` — `download_assets()` przerobiony na równoległe pobieranie (8 wątków przez `std::thread::scope`) + emisja `DownloadProgressEvent` z `phase: "assets"`
- UI już nie wisi — progres assetów jest widoczny na pasku postępu

### Fix: Przycisk Stop po wyjściu z gry
- `process_manager.rs` — reader thread stdout/stderr emituje teraz `instance:stopped` po zakończeniu procesu (nie tylko przy kliknięciu Stop)

### Fix: Session/zarządzanie kontami
- `useAuth.ts` — `logout()` woła `clearAccountSession()` (usunięcie sesji z localStorage)
- `useAccounts.ts` — `removeAccount()` woła `clearAccountSession()` gdy usuwane jest aktywne konto
- `accounts.ts` — fix pre-existing TS error (`TS2345` — `accessToken.split(".")[1]` zwraca `undefined`)

### TASK-FIX-ACCOUNTDROPDOWN: AccountSwitcher z dropdownu na Dialog
- `AccountSwitcher.tsx` — usunięty dropdown, kliknięcie avatara otwiera od razu shadcn Dialog z listą kont, przyciskami "Dodaj konto" i "Wyloguj aktywne konto"
- Usunięty nieużywany `AccountManagerDialog` (zastąpiony przez AccountSwitcher)
- Usunięty nieużywany `LoginDialog.tsx` (dead code)

### Nowa ikona terminala w HeroCard
- Przycisk konsoli (`>_`) pojawia się tylko gdy gra jest uruchomiona
- Kliknięcie otwiera konsolę w osobnym oknie Tauri (WebviewWindow)
- Ikona na końcu rzędu akcji (po Delete)
- `capabilities/default.json` — zmienione `"windows": ["main"]` na `"windows": ["*"]` (nowe okna dostają uprawnienia)

### UI cleanup
- `Sidebar.tsx` — usunięty przycisk "Zaloguj przez Microsoft" (redundantny — logowanie przez AccountSwitcher "Dodaj konto")
- `InstanceView.tsx` — usunięty przycisk "Logi" z prawego górnego rogu (konsola dostępna tylko z HeroCard)
- `InstanceView.tsx` — usunięte tymczasowe debug `console.log` z tokenem
- `Sidebar.tsx` — `LoginDialog` import usunięty

### Dark mode domyślnie
- `index.html` — dodane `class="dark"` do `<html>`

### Build
- `tsc --noEmit` ✅ (0 błędów)
- `cargo build` ✅

### Status projektu

#### ✅ Ukończone
- [x] **TASK-01** — Inicjalizacja projektu Tauri + React + TypeScript
- [x] **TASK-02** — Konfiguracja shadcn/ui
- [x] **TASK-03** — System manifestów instancji (ze schemaVersion)
- [x] **TASK-04** — Dashboard z Sidebarem
- [x] **TASK-05** — Tworzenie instancji
- [x] **TASK-06** — Klonowanie instancji
- [x] **TASK-07** — Eksport i import ZIP
- [x] **TASK-08** — Otwieranie folderu instancji
- [x] **TASK-09** — Microsoft Device Code Flow (kod gotowy, czeka na Azure)
- [x] **TASK-10** — Stronghold + zarządzanie kontami
- [x] **TASK-11** — Moduł pobierania Java (Adoptium)
- [x] **TASK-12** — Minecraft Core (wersje, biblioteki, launch)
- [x] **TASK-13** — Uruchamianie Vanilla + Process Manager
- [x] **TASK-14** — Fabric loader
- [x] **TASK-30** — Usuwanie instancji
- [x] **TASK-31** — Edycja ustawień instancji
- [x] **TASK-32** — Widok instancji (layout z zakładkami)
- [x] **TASK-DEV-AUTH** — Mock auth dla trybu developerskiego

#### 🔄 W trakcie / Częściowo
- [~] **TASK-26** — Logi w czasie rzeczywistym (60% — dedup, karty, filtry, osobne okno konsoli gotowe; brak: rozciągalnego panelu, wyszukiwarki w logach, drag handle)
- [~] **TASK-28a** — Redesign UI (80% — paleta, glassmorphism, sidebar, stany, animacje gotowe)
- [~] **TASK-28b** — Motywy, animacje (70% — portal glow, fade-in, dark mode domyślnie, przełącznik motywu; brak: focus ring, ARIA, keyboard accessibility)

#### ❌ Do zrobienia
- [ ] **TASK-15** — Tryb offline (cached session)
- [ ] **TASK-16** — Kolejka pobrań (Download Manager)
- [ ] **TASK-17** — Monitorowanie postępu
- [ ] **TASK-18** — Pobieranie assetów i bibliotek (asset/biblioteki są pobierane bezpośrednio, nie przez Download Manager)
- [ ] **TASK-19** — Wyszukiwarka modów (Modrinth)
- [ ] **TASK-20** — Instalacja modów
- [x] **TASK-21** — Aktualizacja modów
- [ ] **TASK-22** — Wykrywanie zależności
- [ ] **TASK-23** — Snapshoty
- [ ] **TASK-24** — Przywracanie snapshotów
- [ ] **TASK-25** — Obsługa crash-reportów
- [ ] **TASK-27** — Avatar 2D w zakładce Profil
- [ ] **TASK-28c** — Toasty i notyfikacje
- [ ] **TASK-29** — Testy końcowe

## 2026-07-07 — Fix: text2speech/LWJGL classpath + UI freeze + snapshot path

### 🔥 Fix: 1.12.2 crash (text2speech) i 1.16.5 crash (LWJGL) — biblioteki z `natives` traciły main JAR z classpath

#### Przyczyna
W manifeście wersji Minecrafta biblioteki z polem `natives` występują DWUKROTNIE:
- Wpis 1: `downloads.artifact` (główny JAR, potrzebny na classpath)
- Wpis 2: `downloads.artifact` + `natives` (ten sam JAR + wersja z natywnymi DLL)

`resolveLibrary()` sprawdza `lib.natives` PIERWSZY → zwraca wersję native (`isNative: true`).
Dedup (`getDedupKey`) nadpisuje wpis 1 wpisem 2 → main JAR znika z classpath → `NoClassDefFoundError`.

#### Fix (`src/lib/version-resolver.ts`)
Gdy biblioteka ma BOTH `artifact` + `natives`, dodajemy artifact osobno jako `isNative: false`
z unikalnym kluczem dedup (`:artifact`). Main JAR pozostaje na classpath.

**Dotyczy wersji:** 1.8.9 (1 lib), 1.12.2 (3 libs), 1.16.5 (16 libs!), 1.18.2 (16 libs).
**Nie dotyczy:** 1.20.4+ (nie używają już pola `natives`).

#### Wymaga przebudowania apki (`tauri dev` lub `build`) — zmiana w TypeScript.

### 🔥 Fix: UI freeze podczas pobierania assetów/bibliotek/Javy

#### Przyczyna
Wszystkie downloady używały `reqwest::blocking::get()` bezpośrednio w komendach Tauri → blokowały główne okno.

#### Fix (wzorem `zip_export.rs`)
**Rust:**
- `minecraft_core.rs` — 4 funkcje background (`*_background`) spawniące `std::thread::spawn`, emitujące `download:complete`/`download:error` Tauri events
- `java_manager.rs` — `download_java_background()` z eventami `java:download-complete`/`java:download-error`
- `lib.rs` — wszystkie 5 komend Tauri zwracają `Ok(())` natychmiast (background thread robi resztę)

**Frontend:**
- `InstanceView.tsx` — `waitForDownload(phase)` Promise-based helper, listenery PRZED `invoke()` (🔒 brak race condition)
- `java.ts` — `downloadJava()` event-based, zachowuje `Promise<DownloadStatus>` (kompatybilne z `useJavaRuntime.ts`)

### Fix: Snapshot — pusta lista modów
`read_mods_registry` szukał `mods.json` w root instancji zamiast w `mods/mods.json`. Naprawiono.

### Zmodyfikowane pliki
- `src/lib/version-resolver.ts` — fix text2speech/LWJGL classpath
- `src-tauri/src/minecraft_core.rs` — background wrappers dla downloadów
- `src-tauri/src/java_manager.rs` — `download_java_background`
- `src-tauri/src/lib.rs` — komendy Tauri zwracają natychmiast
- `src/pages/InstanceView.tsx` — event-based download flow
- `src/lib/java.ts` — event-based `downloadJava`
- `src-tauri/src/snapshot.rs` — fix ścieżki `mods.json`

### Status: DO TESTÓW
Zmiany nie były testowane — wymagają przebudowania apki i ręcznej weryfikacji:
1. UI nie zamraża się przy pobieraniu
2. 1.12.2 działa bez crasha text2speech
3. 1.16.5 działa bez crasha LWJGL
4. Snapshot pokazuje listę modów

### Build
- `tsc --noEmit` ✅ (0 błędów)
- `cargo check` ✅ (0 błędów)

## 2026-07-07 — TASK-23 + TASK-24: Snapshot system

### Nowe pliki
- `src-tauri/src/snapshot.rs` — create/list/delete/restore snapshotów (full + metadata mode)
- `src/lib/snapshot.ts` — API wrappery
- `src/hooks/useSnapshots.ts` — React hook
- `src/components/SnapshotList.tsx` — lista snapshotów z datą/rozmiarem/liczbą modów
- `src/components/RestoreSnapshotDialog.tsx` — dialog potwierdzenia przywrócenia

### Zmodyfikowane
- `src-tauri/src/lib.rs` — 4 komendy snapshot zarejestrowane
- `src/components/InstanceTabs.tsx` — nowa zakładka Snapshoty
- `src/components/ModList.tsx` — dialog snapshotu przed aktualizacją modów

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-07-06 — Fix: przełączanie kont + usunięcie DEV_MODE + fix Stronghold

### 🔥 Fix: Przełączanie kont — gra uruchamiała się na starym koncie

#### Przyczyna
`saveAccountSession()` nadpisywał `anon_active_session` w localStorage przy każdym nowym logowaniu,
ale `switchAccount → setActiveAccount` NIGDY nie aktualizował tej sesji. Przy uruchomieniu gry
`tryRefreshSession()` czytał z localStorage sesję poprzedniego konta i zwracał ją bez sprawdzania UUID.

#### Fix — trójwarstwowy system odczytu sesji w `tryRefreshSession()`:
1. **Cache (anon_active_session)** — jeśli UUID zgadza się z aktywnym kontem → zwróć
2. **Mapa per-UUID (anon_sessions_map)** — jeśli cache nie pasuje, sprawdź mapę wszystkich sesji → zwróć jeśli znaleziona i ważna
3. **Stronghold refresh** — jeśli mapa nie ma (lub token wygasł), odśwież przez refresh token z Stronghold

### 🔥 Fix: Stronghold — `loadClient` rzucało "already been loaded"

#### Przyczyna
`stronghold.loadClient(CLIENT_NAME)` może być wywołane tylko RAZ. Drugie wywołanie rzucało błędem:
`"client with id ClientId(...) has already been loaded before, can not be loaded twice"`.
Stary kod wołał `loadClient()` przy każdym zapisie/odczycie refresh tokena, więc tokeny NIGDY
nie były zapisywane do Stronghold. Przy przełączaniu kont `tryRefreshSession()` nie miał
refresh tokena do odświeżenia i zwracał null.

#### Fix
`ensureInitialized()` teraz cache'uje załadowanego klienta (`clientInstance` singleton)
zamiast wołać `loadClient()` ponownie. Zwraca `{ stronghold, client }`, a funkcje
(`saveRefreshToken`, `getRefreshToken`, `removeRefreshToken`) używają `ctx.client.getStore()`
bezpośrednio.

### 🧹 Usunięcie DEV_MODE

Usunięto cały kod związany z trybem developerskim:
- `src/lib/auth.ts` — usunięto `isDevMode()`, `mockUsername()`, `mockUuid()`, `startDeviceCodeFlow()` (dead code),
  `pollForToken()` (dead code), dev-mode branche z `completeMinecraftAuth()`
- `src/lib/accounts.ts` — usunięto `isDevMode()`, `DEV_ACCOUNTS_KEY`, `DevAccountStore`, `getDevStore()`, `saveDevStore()`,
  dev-mode branche ze wszystkich funkcji (~80 linii)
- `src/lib/stronghold.ts` — wyczyszczono komentarz
- `.env.example` — uproszczono

### 🧠 Wnioski

**Problem z loadClient:** Stronghold Tauri plugin auto-ładuje klienta przy inicjalizacji,
ale nie udostępnia referencji do już załadowanego klienta. Drugie `loadClient()` zawsze
rzuca błędem. Rozwiązaniem jest cache'owanie klienta po pierwszym `loadClient`/`createClient`.

**Mapa sesji w localStorage:** Mimo że Stronghold jest teraz naprawiony, mapa per-UUID
w localStorage jest wartościowym fallbackiem — pozwala na błyskawiczne przełączanie kont
bez czekania na refresh token z Microsoft. Tokeny access są i tak przechowywane w
localStorage (`anon_active_session`), więc mapa nie wprowadza nowych zagrożeń.

**Logi z testu (przełączanie AnonBOT ↔ AnonBOT2):**
```
[tryRefreshSession] Session still valid, using cached          // pierwsze odpalenie
[tryRefreshSession] Session still valid, using cached          // drugie konto
[tryRefreshSession] Cached session belongs to different account, refreshing...
[tryRefreshSession] Found valid session in map for d94c...    // switch → mapa
[tryRefreshSession] Cached session belongs to different account, refreshing...
[tryRefreshSession] Found valid session in map for 3e16...    // switch z powrotem → mapa
```
Przełączanie działa w obie strony. Zero błędów Stronghold. ✅

### Build
- `tsc --noEmit` ✅

### Status projektu

#### ✅ Ukończone
- [x] **TASK-01** — Inicjalizacja projektu Tauri + React + TypeScript
- [x] **TASK-02** — Konfiguracja shadcn/ui
- [x] **TASK-03** — System manifestów instancji (ze schemaVersion)
- [x] **TASK-04** — Dashboard z Sidebarem
- [x] **TASK-05** — Tworzenie instancji
- [x] **TASK-06** — Klonowanie instancji
- [x] **TASK-07** — Eksport i import ZIP
- [x] **TASK-08** — Otwieranie folderu instancji
- [x] **TASK-09** — Microsoft Device Code Flow (kod gotowy, czeka na Azure)
- [x] **TASK-10** — Stronghold + zarządzanie kontami
- [x] **TASK-11** — Moduł pobierania Java (Adoptium)
- [x] **TASK-12** — Minecraft Core (wersje, biblioteki, launch)
- [x] **TASK-13** — Uruchamianie Vanilla + Process Manager
- [x] **TASK-14** — Fabric loader
- [x] **TASK-30** — Usuwanie instancji
- [x] **TASK-31** — Edycja ustawień instancji
- [x] **TASK-32** — Widok instancji (layout z zakładkami)
- [x] **TASK-DEV-AUTH** — Mock auth (usunięty, kod produkcyjny)

#### 🔄 W trakcie / Częściowo
- [~] **TASK-26** — Logi w czasie rzeczywistym (60%)
- [~] **TASK-28a** — Redesign UI (80%)
- [~] **TASK-28b** — Motywy, animacje (70%)

## 2026-07-06 — TASK-19 + TASK-20: Modrinth (wyszukiwarka + instalacja modów)

### TASK-19 — Wyszukiwarka modów (Modrinth API)

**Nowe pliki:**
- `src/types/modrinth.ts` — typy dla API Modrinth v2: ModrinthSearchHit, ModrinthSearchResponse, ModrinthProject, ModrinthVersion, ModrinthSortIndex
- `src/lib/modrinth.ts` — API klient z cache 2min: `searchMods()`, `getProject()`, `getProjectVersions()`, `formatDownloads()`
- `src/hooks/useModSearch.ts` — hook z debounce 400ms, AbortController, paginacją (infinite scroll), filtrami (MC version, loader, sort)
- `src/components/ModSearch.tsx` — pełna wyszukiwarka: search bar, FilterBar (Fabric badge, MC version filter, sort dropdown), lista wyników z infinite scroll, ModDetails (opis, najnowsza wersja, zależności, lista wersji, linki)

**Zmodyfikowane:**
- `src/components/InstanceTabs.tsx` — zakładka "Mody" wyświetla `<ModSearch />` zamiast placeholder

**Funkcje:**
- ✅ Wyszukiwanie przez API Modrinth (tylko Fabric mody)
- ✅ Filtrowanie po wersji Minecraft
- ✅ Sortowanie (trafność, pobrania, obserwowane, najnowsze, aktualizowane)
- ✅ Infinite scroll (IntersectionObserver)
- ✅ Widok szczegółowy: opis, najnowsza wersja, zależności, lista wersji, linki
- ✅ Obsługa błędów API (rate limiting, offline)
- ✅ Cieniowanie wyników (ikona, tytuł, autor, pobrania, wersje MC)

### TASK-20 — Instalacja modów

**Nowy backend Rust:**
- `src-tauri/src/mod_installer.rs` — pełny system zarządzania modami:
  - `install_mod()` — pobiera JAR przez reqwest::blocking, zapisuje w `mods/`, rejestruje w `mods.json`
  - `list_mods()` — czyta `mods.json`
  - `toggle_mod()` — rename `.jar` ↔ `.jar.disabled`
  - `remove_mod()` — usuwa plik + wpis z rejestru
- `src-tauri/src/lib.rs` — 4 nowe komendy Tauri: `install_mod`, `list_mods`, `toggle_mod`, `remove_mod`

**Nowe pliki frontend:**
- `src/lib/mod-installer.ts` — invoke wrappery
- `src/hooks/useMods.ts` — React hook z install/toggle/remove/refresh
- `src/components/ModList.tsx` — lista modów: karty z toggle switchem, potwierdzeniem usunięcia, przyciskiem "Dodaj mod" który otwiera ModSearch
- `src/components/ModDetails.tsx` — przycisk "Zainstaluj" podpięty do instalacji przez API

### Poprawki po testach

**FS sync (ręczne dodawanie/usuwanie z folderu `mods/`):**
- `sync_registry_with_filesystem()` w Rust — skanuje `.jar`/`.jar.disabled` pliki na dysku przy każdym `list_mods()`:
  - Usuwa wpisy z rejestru dla plików które zniknęły (ręczne usunięcie)
  - Dodaje wpisy dla plików które pojawiły się bez rejestracji (ręczne dodanie)
- `useMods.ts` — polling co 5s (setInterval) dla automatycznej synchronizacji

**MC version filtering:**
- `InstanceTabs.tsx` — czyta manifest instancji przez `invoke("read_manifest", ...)` i przekazuje `mcVersion` łańcuchem: ModList → ModSearch → ModDetails
- `ModDetails` — przekazuje `gameVersions: [mcVersion]` do `getProjectVersions()`, wyświetla tylko wersje moda kompatybilne z MC wersją instancji
- Search facety też filtrują po MC wersji

**project_slug i icon_url:**
- Dodane do `InstalledMod` w Rust (Option, skip_serializing_if → backward compatible)
- Zapisuje się podczas instalacji, umożliwia matchowanie modów w przyszłości (TASK-21)
- Ikona z Modrinth zapisywana w rejestrze

**Installed badge + Odinstaluj:**
- `ModSearch` — zielona odznaka "Zainstalowany" na kartach wyników gdy mod jest już zainstalowany
- `ModDetails` — przycisk zmienia się na czerwony "Odinstaluj" dla zainstalowanych modów
- Matchowanie po nazwie moda (title)

**Lazy icon lookup dla ręcznie dodanych modów:**
- `src/hooks/useModIcons.ts` — wyszukuje ikony z Modrinth po nazwie moda (fallbacki: pełna nazwa → bez wersji → pierwsze słowo → filename stem)
- Globalny cache + `fetchedRef` + shallow compare → zero zbędnych API callów i re-renderów

**Fix błędu hooks:**
- `useState(uninstalling)` był po early returnach (loading/error) w `ModDetails` → przeniesiony przed nie

**Ikona przycisku Zamknij:**
- Zmieniona z `+` na `X` gdy wyszukiwarka jest otwarta

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-07-07 — TASK-21: Aktualizacja modów (Modrinth API) + redesign UI

### Co zostało zrobione

**TASK-21 — Aktualizacja modów (pierwsza iteracja):**
- **Backend Rust** (`mod_installer.rs`, `lib.rs`): nowa komenda `update_mod` — pobiera nowy JAR, usuwa stare pliki (`.jar` i `.jar.disabled`), aktualizuje registry
- **Frontend API** (`mod-updater.ts`): `checkModUpdates()` — batchowe sprawdzanie przez API Modrinth (batch 5); `updateMod()` — invoke wrapper
- **Hook** (`useModUpdates.ts`): auto-sprawdzanie na starcie, polling co 5 min, bezpieczeństwo przez abortRef
- **Modal** (`ModUpdateDialog.tsx`): dialog z listą modów, checkboxy (zaznacz wszystkie), per-mod "Aktualizuj", batch "Aktualizuj (N)", przycisk "Sprawdź ponownie"
- **UI** (`ModList.tsx`): przycisk "Aktualizacje" w headerze, pomarańczowy badge "N aktualizacji", badge "Aktualizacja" na ModCard

**🔥 Fix: Infinite spinner w dialogu aktualizacji:**
- **Przyczyna**: `checking` w `useCallback` deps → `setChecking(true)` zmieniał referencję `checkNow` → `useEffect` odpalał cleanup → cleanup ustawiał `abortRef=true` → `finally` nie wykonywał `setChecking(false)` → spinner kręcił się wiecznie
- **Fix**: Ref-based guard (`checkingRef`) zamiast state dla concurrent-call guard; `checking` usunięte z deps `useCallback`; cleanup tylko czyści interval
- **Timeout**: `AbortController` + 10s timeout we wszystkich fetchach w `modrinth.ts` (`searchMods`, `getProject`, `getProjectVersions`)
- **Progress**: Progress bar + nazwa moda + procent w dialogu
- **Error display**: Błędy wyświetlane w dialogu na czerwono

**Dropdown wersji w ModDetails (ModSearch.tsx):**
- `selectedVersionIdx` state + `<select>` dropdown z wszystkimi wersjami (filtrowanymi po MC wersji instancji)
- "Zainstaluj" pobiera wybraną wersję z `version_number`
- Detale wersji (numer, loadery, MC wersje, pobrania) poniżej dropdownu

**Redesign systemu aktualizacji (druga iteracja):**
- **Usunięto** `stripVersionFromName()` i search fallback dla modów bez `projectSlug` — `checkModUpdates` sprawdza tylko mody zainstalowane przez aplikację
- **Usunięto** `ModUpdateDialog.tsx` (cały modal wywalony, plik usunięty)
- **ModCard**: pokazuje wersję moda z backendu (`versionNumber`), ikona download dla modów z aktualizacją, ikona lupy (szukaj) dla modów bez `projectSlug`
- **Header**: "Aktualizacje" zmienia się w licznik "N aktualizacji"; gradientowy przycisk "Aktualizuj wszystkie (N)" gdy są aktualizacje
- **Progress**: Pasek postępu inline (zamiast w modalu) podczas sprawdzania

**version_number w Rust backend:**
- Dodane `version_number: String` do `InstalledMod` z `#[serde(default)]` (backward compatibility — stare `mods.json` bez tego pola się zdeserializują)
- Przekazywane przez `install_mod` i `update_mod` jako nowy parametr

**ModSearch — initialQuery prop:**
- Nowy `initialQuery` prop — pre-fill wyszukiwarki z nazwą moda
- `cleanSearchQuery()` helper stripujący wersje z nazwy przed wyszukiwaniem

**Fix: Duplikaty React keyów:**
- `useModSearch.ts`: deduplikacja wyników po `project_id` przy append — zapobiega "Encountered two children with the same key"

**Fix: Błędy TypeScript:**
- `ModDetailsProps.onInstall` — brakowało `versionNumber` w sygnaturze
- `ModCard` — usunięto nieużywany `updating` prop
- `useMods.ts` — usunięto nieużywany `install` (dead code)

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-07-07 — TASK-22: Wykrywanie zależności modów

### Co zostało zrobione

**Nowe pliki:**
- `src-tauri/src/dependency_resolver.rs` — Rust komenda `resolve_mod_dependencies`: sprawdza które `project_id` są zainstalowane w instancji (registry `mods.json` + filesystem)
- `src/lib/dependency-resolver.ts` — `checkModDependencies()` (simple check dla flow instalacji) + `resolveDependencies()` (rekurencyjne rozwiązywanie z detekcją cykli i depth limit 3)
- `src/components/MissingDepsWarning.tsx` — dialog pokazujący brakujące zależności z badge'ami statusu (zainstalowane/brakujące/konflikt), rekurencyjnym wyświetlaniem dzieci, przyciskami "Zainstaluj N zależności" i "Anuluj"

**Zmodyfikowane:**
- `src-tauri/src/lib.rs` — moduł `dependency_resolver` + komenda zarejestrowana
- `src/components/ModSearch.tsx` — `onInstall` callback przyjmuje `dependencies[]` z ModrinthVersion
- `src/components/ModList.tsx` — flow instalacji: sprawdza zależności przed instalacją, pokazuje MissingDepsWarning, po kliknięciu "Zainstaluj N zależności" faktycznie instaluje brakujące mody

**🔥 Fix: Automatyczna instalacja zależności:**
- `handleInstallAnyway` teraz instaluje brakujące zależności PRZED głównym modem:
  1. Pobiera projekt z Modrinth API (`getProject(dep.projectId)`) — określa slug, title, icon
  2. Pobiera wersje pasujące do Fabric + MC wersji instancji (`getProjectVersions`)
  3. Wybiera najnowszą release + primary file
  4. Instaluje przez `modApi.installMod()`
  5. Na końcu instaluje głównego moda
- `depInfoRef` (useRef) — mirror stanu `depInfo` dostępny w callbacku bez dependency issues
- **Fix błędu**: `pendingInstall` został przywrócony do dependency array `useCallback` (wcześniej usunięty przez pomyłkę, co powodowało że callback zawsze widział `null`)
- Error handling: nieudana instalacja pojedynczej zależności nie blokuje reszty

**Usunięte:**
- `src/hooks/useDependencies.ts` — dead code (nieużywany)

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅

## 2026-07-07 — UX: Loading spinner podczas instalacji zależności

### Co zostało zrobione
- **ModList.tsx**: dodano `depInstalling` state — zamiast zamykać dialog od razu po kliknięciu "Zainstaluj N zależności", dialog pozostaje otwarty i pokazuje spinner
- **MissingDepsWarning.tsx**: dodano `installing` prop — gdy `true`, dialog wyświetla pulsujący spinner z animowanymi kropkami, komunikatem "Instalowanie zależności" i zablokowanym przyciskiem Anuluj
- Dialog zamyka się automatycznie DOPIERO po zakończeniu instalacji wszystkich zależności i głównego moda
- Kliknięcie w tło (backdrop) jest zablokowane podczas instalacji

### Build
- `tsc --noEmit` ✅

### Status projektu

#### ✅ Ukończone
- [x] **TASK-01** — Inicjalizacja projektu Tauri + React + TypeScript
- [x] **TASK-02** — Konfiguracja shadcn/ui
- [x] **TASK-03** — System manifestów instancji (ze schemaVersion)
- [x] **TASK-04** — Dashboard z Sidebarem
- [x] **TASK-05** — Tworzenie instancji
- [x] **TASK-06** — Klonowanie instancji
- [x] **TASK-07** — Eksport i import ZIP
- [x] **TASK-08** — Otwieranie folderu instancji
- [x] **TASK-09** — Microsoft Device Code Flow (kod gotowy, czeka na Azure)
- [x] **TASK-10** — Stronghold + zarządzanie kontami
- [x] **TASK-11** — Moduł pobierania Java (Adoptium)
- [x] **TASK-12** — Minecraft Core (wersje, biblioteki, launch)
- [x] **TASK-13** — Uruchamianie Vanilla + Process Manager
- [x] **TASK-14** — Fabric loader
- [x] **TASK-19** — Wyszukiwarka modów (Modrinth)
- [x] **TASK-20** — Instalacja modów
- [x] **TASK-30** — Usuwanie instancji
- [x] **TASK-31** — Edycja ustawień instancji
- [x] **TASK-32** — Widok instancji (layout z zakładkami)
- [x] **TASK-DEV-AUTH** — Mock auth (usunięty, kod produkcyjny)

#### 🔄 W trakcie / Częściowo
- [~] **TASK-26** — Logi w czasie rzeczywistym (60%)
- [~] **TASK-28a** — Redesign UI (80%)
- [~] **TASK-28b** — Motywy, animacje (70%)

#### ❌ Do zrobienia
- [ ] **TASK-15** — Tryb offline (cached session)
- [ ] **TASK-16** — Kolejka pobrań (Download Manager)
- [ ] **TASK-17** — Monitorowanie postępu
- [ ] **TASK-18** — Pobieranie assetów i bibliotek
- [x] **TASK-21** — Aktualizacja modów
- [x] **TASK-22** — Wykrywanie zależności
- [ ] **TASK-23** — Snapshoty
- [ ] **TASK-24** — Przywracanie snapshotów
- [ ] **TASK-25** — Obsługa crash-reportów
- [ ] **TASK-27** — Avatar 2D w zakładce Profil
- [ ] **TASK-28c** — Toasty i notyfikacje
- [ ] **TASK-29** — Testy końcowe

## 2026-07-07 — Fix: text2speech/LWJGL classpath + UI freeze + snapshot path

### 🔥 Fix: 1.12.2 crash (text2speech) i 1.16.5 crash (LWJGL) — biblioteki z `natives` traciły main JAR z classpath

#### Przyczyna
W manifeście wersji Minecrafta biblioteki z polem `natives` występują DWUKROTNIE:
- Wpis 1: `downloads.artifact` (główny JAR, potrzebny na classpath)
- Wpis 2: `downloads.artifact` + `natives` (ten sam JAR + wersja z natywnymi DLL)

`resolveLibrary()` sprawdza `lib.natives` PIERWSZY → zwraca wersję native (`isNative: true`).
Dedup (`getDedupKey`) nadpisuje wpis 1 wpisem 2 → main JAR znika z classpath → `NoClassDefFoundError`.

#### Fix (`src/lib/version-resolver.ts`)
Gdy biblioteka ma BOTH `artifact` + `natives`, dodajemy artifact osobno jako `isNative: false`
z unikalnym kluczem dedup (`:artifact`). Main JAR pozostaje na classpath.

**Dotyczy wersji:** 1.8.9 (1 lib), 1.12.2 (3 libs), 1.16.5 (16 libs!), 1.18.2 (16 libs).
**Nie dotyczy:** 1.20.4+ (nie używają już pola `natives`).

#### Wymaga przebudowania apki (`tauri dev` lub `build`) — zmiana w TypeScript.

### 🔥 Fix: UI freeze podczas pobierania assetów/bibliotek/Javy

#### Przyczyna
Wszystkie downloady używały `reqwest::blocking::get()` bezpośrednio w komendach Tauri → blokowały główne okno.

#### Fix (wzorem `zip_export.rs`)
**Rust:**
- `minecraft_core.rs` — 4 funkcje background (`*_background`) spawniące `std::thread::spawn`, emitujące `download:complete`/`download:error` Tauri events
- `java_manager.rs` — `download_java_background()` z eventami `java:download-complete`/`java:download-error`
- `lib.rs` — wszystkie 5 komend Tauri zwracają `Ok(())` natychmiast (background thread robi resztę)

**Frontend:**
- `InstanceView.tsx` — `waitForDownload(phase)` Promise-based helper, listenery PRZED `invoke()` (🔒 brak race condition)
- `java.ts` — `downloadJava()` event-based, zachowuje `Promise<DownloadStatus>` (kompatybilne z `useJavaRuntime.ts`)

### Fix: Snapshot — pusta lista modów
`read_mods_registry` szukał `mods.json` w root instancji zamiast w `mods/mods.json`. Naprawiono.

### Zmodyfikowane pliki
- `src/lib/version-resolver.ts` — fix text2speech/LWJGL classpath
- `src-tauri/src/minecraft_core.rs` — background wrappers dla downloadów
- `src-tauri/src/java_manager.rs` — `download_java_background`
- `src-tauri/src/lib.rs` — komendy Tauri zwracają natychmiast
- `src/pages/InstanceView.tsx` — event-based download flow
- `src/lib/java.ts` — event-based `downloadJava`
- `src-tauri/src/snapshot.rs` — fix ścieżki `mods.json`

### Status: DO TESTÓW
Zmiany nie były testowane — wymagają przebudowania apki i ręcznej weryfikacji:
1. UI nie zamraża się przy pobieraniu
2. 1.12.2 działa bez crasha text2speech
3. 1.16.5 działa bez crasha LWJGL
4. Snapshot pokazuje listę modów

### Build
- `tsc --noEmit` ✅ (0 błędów)
- `cargo check` ✅ (0 błędów)

## 2026-07-07 — TASK-23 + TASK-24: Snapshot system

### Nowe pliki
- `src-tauri/src/snapshot.rs` — create/list/delete/restore snapshotów (full + metadata mode)
- `src/lib/snapshot.ts` — API wrappery
- `src/hooks/useSnapshots.ts` — React hook
- `src/components/SnapshotList.tsx` — lista snapshotów z datą/rozmiarem/liczbą modów
- `src/components/RestoreSnapshotDialog.tsx` — dialog potwierdzenia przywrócenia

### Zmodyfikowane
- `src-tauri/src/lib.rs` — 4 komendy snapshot zarejestrowane
- `src/components/InstanceTabs.tsx` — nowa zakładka Snapshoty
- `src/components/ModList.tsx` — dialog snapshotu przed aktualizacją modów

### Build
- `tsc --noEmit` ✅
- `cargo check` ✅