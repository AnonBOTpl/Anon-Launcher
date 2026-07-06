# TASK-12 — Minecraft Core (hybryda TypeScript + Rust)

## Cel
Implementacja własnego resolvowania wersji Minecraft, generowania classpath i argumentów launcha bez gotowych paczek npm.
Frontend (TypeScript) resolvuje JSON z Mojang API, backend (Rust) ściąga pliki i odpala Javę.

## Warstwa
Obie (Frontend + Backend)

## Decyzja architektoniczna
Odrzucono gotowe paczki npm:
- `@xmcl/core` — nieaktualne od roku, niskopoziomowe API
- `minecraft-java-core` (luuxis) — aktywne, ale licencja CC BY-NC (non-commercial)

Zastosowano **podejście hybrydowe** — własna implementacja, zero zależności npm.

## Pliki utworzone

### Frontend (TypeScript)
- `src/types/minecraft.ts` — typy dla JSON structures Minecrafta (MinecraftVersionJson, MinecraftLibrary, ResolvedVersion, LaunchOptions, itd.)
- `src/lib/version-resolver.ts` — rozwiązywanie wersji:
  - `fetchVersionManifest()`, `fetchVersionJson(url)` — pobieranie danych z Mojang API
  - `fetchFabricMeta(mcVersion, loaderVersion)` — pobieranie profilu Fabric
  - `resolveVersion(mcVersion, loader?)` — główna funkcja: parsuje JSON, stosuje reguły OS na bibliotekach, scala Fabric, zwraca ResolvedVersion
  - `evaluateRules(rules)` — evaluacja reguł OS (windows/osx/linux, x64/x86)
  - `resolveLibrary(lib)` — resolvuje bibliotekę (artifact/natives/fallback URL)
  - `getDownloadList(resolved)` — dzieli na biblioteki, natywne i client.jar
- `src/lib/minecraft-core.ts` — generowanie argumentów:
  - `generateClasspath(resolved, gameDir)` — lista JARów w classpath
  - `generateLaunchArgs(options)` — pełna tablica argumentów JVM + Minecraft z tokenizacją

### Backend (Rust)
- `src-tauri/src/minecraft_core.rs` — pobieranie i launch:
  - `download_libraries(libraries[])` — biblioteki do `$APP_DATA/libraries/`
  - `download_assets(index)` — assety do `$APP_DATA/assets/objects/`
  - `download_client_jar(version, url, size)` — client.jar do `$APP_DATA/versions/`
  - `launch_minecraft(java_path, args, game_dir, detached)` — spawn procesu Java
- `src-tauri/src/lib.rs` — 4 nowe komendy Tauri

## Zależności
TASK-03, TASK-11

## Definition of Done
- ✅ `resolveVersion` zwraca poprawne metadata dla Vanilla i Fabric
- ✅ `generateClasspath` zwraca listę JARów z bibliotekami i grą
- ✅ `generateLaunchArgs` generuje poprawne argumenty uruchomieniowe
- ✅ Obsługa błędów dla nieznanych wersji
