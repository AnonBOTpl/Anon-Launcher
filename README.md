<div align="center">

# AnonLauncher 🚀

**A modern, lightweight Minecraft launcher** — cross-platform, with full mod, modpack, resource pack, and shader support.

<br />

![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri&labelColor=1a1a1a)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&labelColor=1a1a1a)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&labelColor=1a1a1a)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&labelColor=1a1a1a)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&labelColor=1a1a1a)

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[🇵🇱 Polski](README-pl.md)

</div>

---

## ✨ Overview

AnonLauncher is a modern, lightweight and universal Minecraft launcher that lets you easily manage multiple **game instances**, **mods**, **modpacks**, **resource packs**, and **shaderpacks** — all in one sleek interface.

### Key Features

| Feature | Status |
|---|---|
| ✅ Multi-instance management (create, clone, ZIP export/import) | Done |
| ✅ Vanilla + Fabric launch (including Fabric API) | Done |
| ✅ Auto Java download from Adoptium API | Done |
| ✅ Microsoft Device Code Flow login | Done |
| ✅ Multi-account with Stronghold encrypted storage | Done |
| ✅ Mod search and installation (Modrinth API) | Done |
| ✅ Mod updates with batch updates | Done |
| ✅ Dependency detection and auto-install | Done |
| ✅ Snapshots (full copy / metadata only) | Done |
| ✅ Modpack (.mrpack) installation with progress bar | Done |
| ✅ Resource packs and shaderpacks with icons and versions | Done |
| ✅ Auto-install Iris Shaders for shaderpacks | Done |
| ✅ Tabbed UI with filtering (Mods / Resources / Shaders / Snapshots / Logs) | Done |
| ✅ Detachable console window with filters and search | Done |
| ✅ Minecraft 26.x support (no `1.` prefix) + Java 25 | Done |
| ✅ Game Overview tab with screenshots and statistics | Done |
| ✅ Update checker (GitHub Releases) | Done |
| ✅ i18n — English + Polish | Done |

---

## 🖼️ Screenshots

*Dashboard* | *Instance View* | *Mod Search*
:---:|:---:|:---:
![Dashboard](https://via.placeholder.com/400x250?text=Dashboard) | ![Instance View](https://via.placeholder.com/400x250?text=Instance+View) | ![Mod Search](https://via.placeholder.com/400x250?text=Mod+Search)

---

## 🧱 Tech Stack

| Layer | Technology |
|---------|------------|
| **Frontend** | React 19 + TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (base-nova) |
| **Desktop Framework** | Tauri v2 (Rust) |
| **Backend** | Rust 2021 edition |
| **Auth** | Microsoft Device Code Flow + Stronghold encryption |
| **APIs** | Modrinth v2, Mojang (piston-meta), Adoptium, Fabric Meta |
| **Icons** | Lucide React |
| **Font** | Geist Variable |
| **Installer** | NSIS (Nullsoft) |

### Architecture

The project uses a **hybrid approach**:

- **TypeScript (Frontend):** resolves Minecraft version JSONs, generates JVM arguments, communicates with Modrinth/Mojang APIs
- **Rust (Backend):** downloads files (JARs, assets, libraries), launches Java process, emits Tauri events, manages the filesystem
- **Tauri Events:** all long-running operations (download, export, modpack installation) run in background threads and communicate progress via events

---

## 📦 Requirements

- **Node.js** >= 18
- **Rust** >= 1.70
- **npm** >= 9

### Operating Systems

| System | Status |
|--------|--------|
| 🪟 Windows | ✅ Tested on Windows 10/11 |
| 🐧 Linux | ✅ Theoretically works (no local tests) |
| 🍎 macOS | ✅ Theoretically works (no tests) |

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/AnonBOTpl/Anon-Launcher.git
cd Anon-Launcher

# 2. Install dependencies
npm install

# 3. Run in dev mode
npm run tauri dev
```

### Building for Production

```bash
npm run tauri build
```

The installer can be found at `src-tauri/target/release/bundle/nsis/`.

---

## 🗂️ Project Structure

```
AnonLauncher/
├── src/                          # Frontend React + TypeScript
│   ├── components/               # UI components
│   │   ├── ui/                  # shadcn/ui base components
│   │   ├── ModSearch.tsx        # Mod search
│   │   ├── ModList.tsx          # Installed mods list
│   │   ├── ContentBrowser.tsx   # Resource/shader search
│   │   ├── ContentList.tsx      # Installed resources/shaders
│   │   ├── ModpackSearch.tsx    # Modpack search
│   │   └── ...                 # ~30 components
│   ├── lib/                     # Business logic
│   │   ├── minecraft-core.ts    # Launch args generation
│   │   ├── version-resolver.ts  # MC version resolution
│   │   ├── modrinth.ts          # Modrinth API client
│   │   ├── content-installer.ts # Resource/shader API
│   │   └── ...                 # ~15 modules
│   ├── hooks/                   # Custom React hooks
│   ├── pages/                   # Application pages
│   ├── types/                   # TypeScript types
│   └── styles/                  # Global styles
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── lib.rs              # Entry point + Tauri commands
│   │   ├── mod_installer.rs    # Mod installation
│   │   ├── modpack_installer.rs # Modpack (.mrpack) installation
│   │   ├── content_installer.rs # Resource/shader installation
│   │   ├── instance_manager.rs  # Instance CRUD
│   │   ├── process_manager.rs   # Game process management
│   │   ├── minecraft_core.rs    # Asset/library downloads
│   │   ├── java_manager.rs      # Java download (Adoptium)
│   │   ├── auth.rs             # Microsoft + XBL + XSTS auth
│   │   ├── account_manager.rs   # Account management
│   │   ├── snapshot.rs         # Snapshot system
│   │   ├── game_data.rs        # Game overview data
│   │   ├── zip_export.rs       # ZIP export
│   │   └── zip_import.rs       # ZIP import
│   ├── installer/              # NSIS installer graphics
│   ├── Cargo.toml
│   └── tauri.conf.json
├── tasks/                       # Task specifications
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🔧 Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Run in dev mode (hot reload) |
| `npm run tauri build` | Build production version |
| `npx tsc --noEmit` | Check TypeScript types |
| `cd src-tauri && cargo check` | Check Rust compilation |
| `cd src-tauri && cargo test` | Run Rust unit tests |

### Conventions

- TypeScript — strict mode, `noUncheckedIndexedAccess`
- Rust — clippy lints
- All Tauri commands use `#[serde(rename_all = "camelCase")]`
- Tauri events use `:` separator, e.g. `modpack:progress`, `export:complete`

---

## 📜 License

This project is licensed under the **MIT License** — feel free to use, modify and distribute.

---

<div align="center">

**AnonLauncher** — created by [AnonBOTpl](https://github.com/AnonBOTpl)

</div>
