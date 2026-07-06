# TASK-19 — Wyszukiwarka modów

## Cel
Implementacja wyszukiwarki modów zintegrowanej z API Modrinth, z możliwością filtrowania, sortowania i przeglądania szczegółów modów.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/lib/modrinth.ts` — API klient dla Modrinth
- `src/hooks/useModSearch.ts`
- `src/components/ModSearch.tsx` — wyszukiwarka
- `src/components/ModSearchResult.tsx` — pojedynczy wynik
- `src/components/ModDetails.tsx` — szczegóły moda
- `src/types/modrinth.ts` — typy dla API Modrinth

## Zależności
TASK-12

## Szczegóły implementacji
1. Użyj `@xmcl/modrinth` lub bezpośrednie REST API Modrinth (`https://api.modrinth.com/v2/`).
2. Wyszukiwanie: `GET /v2/search` z parametrami `query`, `facets` (wersja Minecraft, loader), `limit`, `offset`.
3. Filtry: wersja Minecraft (z instancji lub ręczny wybór), loader (Fabric), kategoria (opcjonalnie).
4. Sortowanie: relevance, downloads, updated, title.
5. Każdy wynik: ikona, tytuł, author, krótki opis, download count, supported versions, loader.
6. `ModDetails` — rozszerzony widok z: pełnym opisem (Markdown), listą wersji, zależnościami, przyciskiem "Instaluj".
7. UI: `ModSearch` — search bar z debounce, lista wyników z infinite scroll lub paginacją, filter panel (bocznym lub górnym).
8. Obsługa błędów API (rate limiting, brak połączenia) z odpowiednim komunikatem.

## Definition of Done
- Wyszukiwarka modów działa z API Modrinth.
- Filtrowanie po wersji Minecraft i loaderze działa.
- Wyniki wyświetlają się z ikoną, tytułem, autorem, pobraniami.
- Widok szczegółowy pokazuje pełny opis, wersje i zależności.
- Obsługa błędów API (rate limit, offline) działa.
