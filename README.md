# AnonLauncher — Uniwersalny Launcher Minecraft

Nowoczesny, lekki i uniwersalny launcher Minecraft dla systemów Windows, Linux oraz macOS. Umożliwia wygodne zarządzanie wieloma instancjami gry, modami oraz środowiskiem Java.

## Stack Technologiczny

| Warstwa | Technologia |
|---------|------------|
| Frontend | React 19, TypeScript, shadcn/ui, Tailwind CSS |
| Desktop Framework | Tauri v2 |
| Logika Minecraft | minecraft-java-core (Node.js sidecar) |
| Repozytorium modów | @xmcl/modrinth |
| Bezpieczeństwo | Tauri Plugin Stronghold |

## Wymagania

- Node.js >= 18
- Rust >= 1.70
- npm >= 9

## Szybki Start

```bash
# Instalacja zależności
npm install

# Uruchomienie w trybie deweloperskim
npm run tauri dev
```

## Budowanie

```bash
# Budowanie wersji produkcyjnej
npm run tauri build
```

## Struktura Projektu

```
AnonLauncher/
├── src/                    # Frontend React + TypeScript
│   ├── components/         # Komponenty UI (shadcn/ui)
│   ├── lib/               # Logika biznesowa, utility
│   ├── pages/             # Strony aplikacji
│   ├── hooks/             # Custom React hooks
│   └── types/             # Typy TypeScript
├── src-tauri/             # Backend Rust (Tauri)
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   └── lib.rs         # Komendy Tauri i logika
│   ├── Cargo.toml         # Zależności Rust
│   └── tauri.conf.json    # Konfiguracja Tauri
├── tasks/                 # Szczegółowe specyfikacje tasków
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Licencja

MIT
