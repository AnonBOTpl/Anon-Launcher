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

[🇬🇧 English](README.md)

</div>

---

## ✨ Przegląd

AnonLauncher to nowoczesny, lekki i uniwersalny launcher Minecraft, który umożliwia wygodne zarządzanie wieloma **instancjami gry**, **modami**, **modpackami**, **resourcepackami** i **shaderpackami** — wszystko w jednym, estetycznym interfejsie.

### Kluczowe cechy

| Cecha | Status |
|---|---|
| ✅ Zarządzanie wieloma instancjami (tworzenie, klonowanie, eksport/import ZIP) | Gotowe |
| ✅ Uruchamianie Vanilla + Fabric (w tym Fabric API) | Gotowe |
| ✅ Automatyczne pobieranie Javy z Adoptium API | Gotowe |
| ✅ Logowanie przez Microsoft Device Code Flow | Gotowe |
| ✅ Wiele kont z Stronghold encryption | Gotowe |
| ✅ Wyszukiwarka i instalacja modów (Modrinth) | Gotowe |
| ✅ Aktualizacja modów z batch updates | Gotowe |
| ✅ Detekcja i automatyczna instalacja zależności | Gotowe |
| ✅ Snapshoty (pełna kopia / tylko metadane) | Gotowe |
| ✅ Instalacja modpacków (.mrpack) z progress barem | Gotowe |
| ✅ Resourcepacki i shaderpacki z ikonami i wersjami | Gotowe |
| ✅ Auto-instalacja Iris Shaders dla shaderpacków | Gotowe |
| ✅ Zakładkowe UI z filtrowaniem (Mody / Zasoby / Shadery / Snapshoty / Logi) | Gotowe |
| ✅ Odpinana konsola z filtrami i wyszukiwarką | Gotowe |
| ✅ Obsługa Minecraft 26.x (bez `1.` prefixu) + Java 25 | Gotowe |
| ✅ Zakładka Gra — zrzuty ekranu, statystyki | Gotowe |
| ✅ Sprawdzanie aktualizacji przez GitHub Releases | Gotowe |
| ✅ i18n — język polski i angielski | Gotowe |

---

## 🧱 Stack Technologiczny

| Warstwa | Technologia |
|---------|------------|
| **Frontend** | React 19 + TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (base-nova) |
| **Desktop Framework** | Tauri v2 (Rust) |
| **Backend** | Rust 2021 edition |
| **Auth** | Microsoft Device Code Flow + Stronghold encryption |
| **API** | Modrinth v2, Mojang (piston-meta), Adoptium, Fabric Meta |
| **Icons** | Lucide React |
| **Font** | Geist Variable |
| **Instalator** | NSIS (Nullsoft) |

---

## 📦 Wymagania

- **Node.js** >= 18
- **Rust** >= 1.70
- **npm** >= 9

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

Instalator znajdziesz w `src-tauri/target/release/bundle/nsis/`.

---

## 🔧 Development

| Komenda | Opis |
|---------|------|
| `npm run tauri dev` | Uruchom w trybie deweloperskim (hot reload) |
| `npm run tauri build` | Zbuduj wersję produkcyjną |
| `npx tsc --noEmit` | Sprawdź typy TypeScript |
| `cd src-tauri && cargo check` | Sprawdź kompilację Rust |
| `cd src-tauri && cargo test` | Uruchom testy jednostkowe Rust |

---

## 📜 Licencja

Projekt jest na licencji **MIT** — możesz go dowolnie używać, modyfikować i dystrybuować.

---

<div align="center">

**AnonLauncher** — stworzony przez [AnonBOTpl](https://github.com/AnonBOTpl)

</div>
