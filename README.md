<div align="center">

<img src="images/logo.png" alt="AnonLauncher" width="100" />

# AnonLauncher

**A modern, lightweight Minecraft launcher**

![Version](https://img.shields.io/github/v/release/AnonBOTpl/Anon-Launcher?style=flat-square&color=a855f7)
![Downloads](https://img.shields.io/github/downloads/AnonBOTpl/Anon-Launcher/total?style=flat-square&color=a855f7)
![License](https://img.shields.io/badge/License-AGPL%20v3-blue?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&labelColor=1a1a1a)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&labelColor=1a1a1a)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&labelColor=1a1a1a)

[🌐 Website](https://anonbotpl.github.io/Anon-Launcher/) · [📦 Releases](https://github.com/AnonBOTpl/Anon-Launcher/releases) · [🇵🇱 Polski](README-pl.md)

</div>

---

![Dashboard](images/dashboard.png)

---

## Features

- 🗂️ **Multi-instance** — create, clone, export and import instances as ZIP
- 🧩 **Vanilla · Fabric · NeoForge** — full loader support with auto-install
- 🔧 **Mod management** — search, install, update and remove mods via Modrinth
- 📦 **Modpack install** — one-click `.mrpack` install from Modrinth or URL
- 🖼️ **Resource packs & Shaders** — browse and install directly from Modrinth
- ☕ **Auto Java** — downloads the right JRE automatically (Java 8–25)
- 🔐 **Microsoft login** — Device Code Flow with encrypted token storage (Stronghold)
- 👥 **Multi-account** — switch between multiple Microsoft accounts
- 📸 **Snapshots** — full or metadata-only backups before mod updates
- 🎨 **Accent colors** — 8 color presets, dark/light theme
- 🌍 **i18n** — English, Polish, German, Japanese, French, Spanish
- 🔔 **Auto-update** — checks GitHub Releases on every launch

---

## Screenshots

| Mod Management | Modpack Install |
|:---:|:---:|
| ![Mods](images/mods.png) | ![Modpack](images/modpack.png) |

---

## Installation

Download the latest Windows installer from [Releases](https://github.com/AnonBOTpl/Anon-Launcher/releases/latest).

> Linux and macOS: build from source (see below).

---

## Building from source

```bash
git clone https://github.com/AnonBOTpl/Anon-Launcher.git
cd Anon-Launcher
npm install
npm run tauri dev       # dev mode
npm run tauri build     # production build
```

**Requirements:** Node.js ≥ 18 · Rust ≥ 1.70 · npm ≥ 9

---

## Tech Stack

[Tauri v2](https://tauri.app) · [React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Rust](https://www.rust-lang.org) · [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS v4](https://tailwindcss.com)

---

## License

[AGPL-3.0](LICENSE) · [Privacy Policy](PRIVACY.md) · [Contributing](CONTRIBUTING.md)

---

<div align="center">
Made by <a href="https://github.com/AnonBOTpl">AnonBOTpl</a>
</div>
