<div align="center">

# AnonLauncher 🚀

**Nowoczesny, lekki launcher Minecraft** — wieloplatformowy, z pełną obsługą modów, modpacków, zasobów i shaderów.

<br />

![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&labelColor=1a1a1a)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&labelColor=1a1a1a)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&labelColor=1a1a1a)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&labelColor=1a1a1a)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&labelColor=1a1a1a)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## ✨ Przegląd

AnonLauncher to nowoczesny, lekki i uniwersalny launcher Minecraft, który umożliwia wygodne zarządzanie wieloma **instancjami gry**, **modami**, **modpackami**, **resourcepackami** i **shaderpackami** — wszystko w jednym, estetycznym interfejsie.

### Kluczowe cechy

| Cecha | Status |
|---|---|
| ✅ Zarządzanie wieloma instancjami (tworzenie, klonowanie, eksport/import ZIP) | Ukończone |
| ✅ Uruchamianie Vanilla + Fabric (w tym Fabric API) | Ukończone |
| ✅ Automatyczne pobieranie Javy z Adoptium API | Ukończone |
| ✅ Logowanie przez Microsoft Device Code Flow | Ukończone |
| ✅ Wiele kont z Stronghold encryption | Ukończone |
| ✅ Wyszukiwarka i instalacja modów (Modrinth) | Ukończone |
| ✅ Aktualizacja modów z batch updates | Ukończone |
| ✅ Detekcja i automatyczna instalacja zależności | Ukończone |
| ✅ Snapshoty (pełna kopia / tylko metadane) | Ukończone |
| ✅ Instalacja modpacków (.mrpack) z progress barem | Ukończone |
| ✅ Resourcepacki i shaderpacki z ikonami i wersjami | Ukończone |
| ✅ Auto-instalacja Iris Shaders dla shaderpacków | Ukończone |
| ✅ Zakładkowe UI z filtrowaniem (Mody / Zasoby / Shadery / Snapshoty / Logi) | Ukończone |
| ✅ Proces gry w osobnym oknie konsoli z filtrami i wyszukiwarką | Ukończone |
| ✅ Obsługa Minecraft 26.x (bez `1.` prefixu) + Java 25 | Ukończone |
| ❌ Obsługa crash-reportów | Planowane |
| ❌ Avatar 2D w profilu | Planowane |

---

## 🖼️ Zrzuty ekranu

*Dashboard z listą instancji* | *Widok instancji z zakładkami* | *Wyszukiwarka modów Modrinth*
:---:|:---:|:---:
![Dashboard](https://via.placeholder.com/400x250?text=Dashboard) | ![Instance View](https://via.placeholder.com/400x250?text=Instance+View) | ![Mod Search](https://via.placeholder.com/400x250?text=Mod+Search)

---

## 🧱 Stack Technologiczny

| Warstwa | Technologia |
|---------|------------|
| **Frontend** | React 19 + TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (base-nova) |
| **Desktop Framework** | Tauri v2 (Rust) |
| **Backend** | Rust 2021 edition |
| **Auth** | Microsoft Device Code Flow + Stronghold encryption |
| **API** | Modrinth API v2, Mojang API (piston-meta), Adoptium API, Fabric Meta API |
| **Icons** | Lucide React |
| **Font** | Geist Variable |

### Architektura

Projekt stosuje **podejście hybrydowe**:

- **TypeScript (Frontend):** resolvuje JSON-y wersji Minecraft, generuje argumenty JVM, komunikuje się z API Modrinth/Mojang
- **Rust (Backend):** ściąga pliki (JARy, asseety, biblioteki), uruchamia proces Java, emituje eventy Tauri, zarządza systemem plików
- **Tauri Events:** wszystkie długotrwałe operacje (download, export, modpack install) działają w background threadach i komunikują postęp przez eventy

### Dlaczego własna implementacja zamiast gotowych paczek?

| Alternatywa | Powód odrzucenia |
|-------------|-----------------|
| `@xmcl/core` | Nieaktualne od roku |
| `minecraft-java-core` (npm) | Licencja CC BY-NC (niekomercyjna) |
| `@xmcl/modrinth` | Zbyt duży, niepotrzebne zależności |

---

## 📦 Wymagania

- **Node.js** >= 18
- **Rust** >= 1.70
- **npm** >= 9

### Systemy operacyjne

| System | Status |
|--------|--------|
| 🪟 Windows | ✅ Działa (testowany na Windows 10/11) |
| 🐧 Linux | ✅ Teoretycznie działa (testy przez CI) |
| 🍎 macOS | ✅ Teoretycznie działa (brak testów) |

---

## 🚀 Szybki Start

```bash
# 1. Sklonuj repozytorium
git clone https://github.com/AnonBOTpl/Anon-Launcher.git
cd Anon-Launcher

# 2. Zainstaluj zależności
npm install

# 3. Uruchom w trybie deweloperskim
npm run tauri dev
```

### Budowanie wersji produkcyjnej

```bash
npm run tauri build
```

Gotowy instalator znajdziesz w `src-tauri/target/release/bundle/`.

---

## 🗂️ Struktura Projektu

```
AnonLauncher/
├── src/                          # Frontend React + TypeScript
│   ├── components/               # Komponenty UI
│   │   ├── ui/                  # shadcn/ui komponenty bazowe
│   │   ├── ModSearch.tsx        # Wyszukiwarka modów
│   │   ├── ModList.tsx          # Lista zainstalowanych modów
│   │   ├── ContentBrowser.tsx   # Wyszukiwarka zasobów/shaderów
│   │   ├── ContentList.tsx      # Lista zainstalowanych zasobów/shaderów
│   │   ├── ModpackSearch.tsx    # Wyszukiwarka modpacków
│   │   └── ...                 # ~30 komponentów
│   ├── lib/                     # Logika biznesowa
│   │   ├── minecraft-core.ts    # Generowanie argumentów launcha
│   │   ├── version-resolver.ts  # Resolvowanie wersji MC
│   │   ├── modrinth.ts          # API klient Modrinth
│   │   ├── content-installer.ts # API dla resourcepacków/shaderów
│   │   └── ...                 # ~15 modułów
│   ├── hooks/                   # Custom React hooks
│   ├── pages/                   # Strony aplikacji
│   ├── types/                   # Typy TypeScript
│   └── styles/                  # Style globalne
├── src-tauri/                   # Backend Rust
│   ├── src/
│   │   ├── lib.rs              # Entry point + Tauri commands
│   │   ├── mod_installer.rs    # Instalacja modów
│   │   ├── modpack_installer.rs # Instalacja modpacków (.mrpack)
│   │   ├── content_installer.rs # Instalacja resourcepacków/shaderów
│   │   ├── instance_manager.rs  # CRUD instancji
│   │   ├── process_manager.rs   # Zarządzanie procesem gry
│   │   ├── minecraft_core.rs    # Pobieranie assetów, bibliotek
│   │   ├── java_manager.rs      # Pobieranie Java z Adoptium
│   │   ├── auth.rs             # Microsoft + XBL + XSTS auth
│   │   ├── account_manager.rs   # Zarządzanie kontami
│   │   ├── snapshot.rs         # Snapshoty
│   │   ├── zip_export.rs       # Eksport do ZIP
│   │   └── zip_import.rs       # Import z ZIP
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tasks/                       # Szczegółowe specyfikacje tasków
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🎯 Funkcjonalności — szczegóły

### 📋 Zarządzanie instancjami

- **Tworzenie** — wybór wersji MC, loadera (Vanilla/Fabric), RAM, Javy, JVM args
- **Klonowanie** — pełna kopia instancji z nową nazwą
- **Edycja** — zmiana nazwy, MC wersji, loadera, RAM, Javy
- **Eksport/Import** — pełna kopia do ZIP z progresem, walidacja manifestu
- **Snapshoty** — pełna kopia folderu lub tylko metadane (manifest + lista modów)

### 🔐 Logowanie i konta

- **Microsoft Device Code Flow** — autoryzacja przez przeglądarkę
- **Wiele kont** — przełączanie między kontami, każdy z własnym refresh tokenem
- **Stronghold Vault** — szyfrowane przechowywanie refresh tokenów
- **Auto-refresh** — odświeżanie tokena przed każdym uruchomieniem

### 🔧 Java

- **Auto-pobieranie** — Eclipse Temurin z Adoptium API
- **Wersje** — Java 8, 11, 17, 21, 25 (dopasowana do wersji MC)
- **Custom path** — możliwość wskazania własnej instalacji Javy
- **Progress** — pasek postępu na żywo przez Tauri events

### 🎮 Uruchamianie gry

- **Vanilla** — standardowe uruchomienie przez Mojang JSON
- **Fabric** — merge bibliotek i klas z Fabric Loader
- **Wersje 26.x** — obsługa nowego systemu wersjonowania (bez `1.` prefixu)
- **Logi** — streaming stdout/stderr przez Tauri events
- **Osobna konsola** — odpinane okno z filtrami, wyszukiwarką, dedupem
- **Catch-unwind** — background thready nie giną cicho

### 🔌 Mody (Modrinth)

- **Wyszukiwanie** — przez API Modrinth v2 z filtrami (MC version, kategoria, sortowanie)
- **Instalacja** — pobieranie i zapis do `mods/` z metadanymi
- **Aktualizacja** — batch sprawdzanie + pojedyncza lub zbiorcza aktualizacja
- **Zależności** — detekcja + auto-instalacja brakujących modów
- **Stan** — toggle włącz/wyłącz (rename `.jar` ↔ `.jar.disabled`)
- **FS sync** — wykrywanie ręcznie dodanych/usuniętych plików

### 📦 Modpacki (.mrpack)

- **Wyszukiwanie** — przez API Modrinth z `project_type:modpack`
- **Instalacja** — pełny flow: download .mrpack → parse `modrinth.index.json` → create instance → download files → copy overrides
- **Metadane** — zapis ikon i wersji modów przez API Modrinth
- **Cancel** — przerwanie + czyszczenie częściowo utworzonej instancji
- **Progress** — pasek postępu w dialogu z przyciskiem anuluj

### 🎨 Resourcepacki i Shadery

- **Paczki zasobów** — wyszukiwanie i instalacja z Modrinth
- **Shaderpacki** — wymagają Fabric + Iris Shaders
- **Auto-instalacja Iris** — jednym kliknięciem pobiera i instaluje Iris
- **Metadane** — ikony, wersje i slugi zapisywane w `content_registry.json`
- **Eksport/Import** — content automatycznie dołączany do ZIP instancji

---

## ⚙️ Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---------|----------|------|
| `VITE_DEV_MODE` | Nie | Gdy `true`, auth działa w trybie mock (tylko do testów) |

---

## 🔧 Development

### Komendy

| Komenda | Opis |
|---------|------|
| `npm run tauri dev` | Uruchom w trybie deweloperskim (hot reload) |
| `npm run tauri build` | Zbuduj wersję produkcyjną |
| `npx tsc --noEmit` | Sprawdź typy TypeScript |
| `cd src-tauri && cargo check` | Sprawdź kompilację Rust |
| `cd src-tauri && cargo test` | Uruchom testy jednostkowe Rust |

### Zasady

- TypeScript — strict mode, `noUncheckedIndexedAccess`
- Rust — clippy lints, `#[serde(deny_unknown_fields)]`
- Wszystkie komendy Tauri używają `#[serde(rename_all = "camelCase")]`
- Eventy Tauri: nazwy z `:`, np. `modpack:progress`, `export:complete`

---

## 📜 Licencja

Projekt jest na licencji **MIT** — możesz go dowolnie używać, modyfikować i dystrybuować.

---

<div align="center">

**AnonLauncher** — stworzony przez [AnonBOTpl](https://github.com/AnonBOTpl)

</div>
