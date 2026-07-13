<div align="center">

<img src="images/logo.png" alt="AnonLauncher" width="100" />

# AnonLauncher

**Nowoczesny, lekki launcher Minecraft**

![Version](https://img.shields.io/github/v/release/AnonBOTpl/Anon-Launcher?style=flat-square&color=a855f7)
![Downloads](https://img.shields.io/github/downloads/AnonBOTpl/Anon-Launcher/total?style=flat-square&color=a855f7)
![License](https://img.shields.io/badge/License-AGPL%20v3-blue?style=flat-square)
![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&labelColor=1a1a1a)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&labelColor=1a1a1a)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&labelColor=1a1a1a)

[🌐 Strona](https://anonbotpl.github.io/Anon-Launcher/) · [📦 Wydania](https://github.com/AnonBOTpl/Anon-Launcher/releases) · [🇬🇧 English](README.md)

</div>

---

![Dashboard](images/dashboard.png)

---

## Funkcje

- 🗂️ **Wiele instancji** — twórz, klonuj, eksportuj i importuj instancje jako ZIP
- 🧩 **Vanilla · Fabric · NeoForge** — pełne wsparcie loaderów z auto-instalacją
- 🔧 **Zarządzanie modami** — wyszukuj, instaluj, aktualizuj i usuwaj mody przez Modrinth
- 📦 **Instalacja modpacków** — jeden klik dla `.mrpack` z Modrinth lub URL
- 🖼️ **Resource packi i Shadery** — przeglądaj i instaluj bezpośrednio z Modrinth
- ☕ **Auto Java** — automatycznie pobiera odpowiednią wersję JRE (Java 8–25)
- 🔐 **Logowanie Microsoft** — Device Code Flow z szyfrowanym przechowywaniem tokenów
- 👥 **Wiele kont** — przełączaj między wieloma kontami Microsoft
- 📸 **Snapshoty** — pełne lub tylko metadanych kopie zapasowe przed aktualizacją modów
- 🎨 **Kolory akcentu** — 8 presetów kolorów, motyw ciemny/jasny
- 🌍 **i18n** — angielski, polski, niemiecki, japoński, francuski, hiszpański
- 🔔 **Auto-update** — sprawdza GitHub Releases przy każdym uruchomieniu

---

## Screenshoty

| Zarządzanie modami | Instalacja modpacka |
|:---:|:---:|
| ![Mody](images/mods.png) | ![Modpack](images/modpack.png) |

---

## Instalacja

Pobierz najnowszy instalator Windows z [Wydań](https://github.com/AnonBOTpl/Anon-Launcher/releases/latest).

> Linux i macOS: buduj ze źródeł (patrz niżej).

---

## Budowanie ze źródeł

```bash
git clone https://github.com/AnonBOTpl/Anon-Launcher.git
cd Anon-Launcher
npm install
npm run tauri dev       # tryb deweloperski
npm run tauri build     # wersja produkcyjna
```

**Wymagania:** Node.js ≥ 18 · Rust ≥ 1.70 · npm ≥ 9

---

## Stack technologiczny

[Tauri v2](https://tauri.app) · [React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org) · [Rust](https://www.rust-lang.org) · [shadcn/ui](https://ui.shadcn.com) · [Tailwind CSS v4](https://tailwindcss.com)

---

## Licencja

[AGPL-3.0](LICENSE) · [Polityka prywatności](PRIVACY.md) · [Contributing](CONTRIBUTING.md)

---

<div align="center">
Stworzone przez <a href="https://github.com/AnonBOTpl">AnonBOTpl</a>
</div>
