# TASK-14 — Integracja Fabric

## Cel
Rozszerzenie systemu uruchamiania o wsparcie dla Fabric Loader — pobieranie loadera, generowanie argumentów z Fabric i uruchamianie gry z modyfikacjami.

## Warstwa
Obie (Frontend + Backend)

## Status
**Zrealizowany w TASK-12.** Integracja Fabric została zrobiona w ramach `resolveVersion()`:

- ✅ `resolveVersion(mcVersion, { type: "fabric", version })` — pobiera Fabric profile z `meta.fabricmc.net`, scala biblioteki, ustawia `mainClass: KnotClient`, scala argumenty JVM/game
- ✅ `fetchFabricMeta()` — pobiera JSON profilu Fabric dla danej wersji MC + loadera
- ✅ `LoaderSelect` — UI do wyboru loadera z auto-pobieraniem wersji Fabric
- ✅ `CreateInstanceForm` — zapisuje loader i loaderVersion w manifeście
- ✅ `handleLaunch` — przekazuje loader do `resolveVersion()` przy uruchomieniu

## Co pozostało (zależne od TASK-19 / Modrinth API)
- [ ] Fabric API auto-install: po wyborze Fabric przy tworzeniu instancji, pobierz najnowszą wersję Fabric API z API Modrinth i umieść w `mods/`

## Pliki do utworzenia / modyfikacji (pozostałe)
- `src/lib/minecraft-versions.ts` (modyfikacja — funkcja pobierająca Fabric API z Modrinth)

## Zależności
TASK-12, TASK-19 (Modrinth API dla Fabric API auto-install)

## Definition of Done
- ✅ Instancja Fabric jest uruchamiana z poprawnym Fabric Loader.
- ✅ Wersja loadera jest zapisana w manifeście i używana przy uruchomieniu.
- ✅ Zmiana wersji loadera w edycji działa.
- [ ] Mody w folderze `mods/` są ładowane przez Fabric (wymaga TASK-20).
- [ ] Fabric API auto-install (zależne od TASK-19).
