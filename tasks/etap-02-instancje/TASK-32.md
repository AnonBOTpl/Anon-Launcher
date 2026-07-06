# TASK-32 — Widok instancji (layout z zakładkami)

## Cel
Kontener widoku pojedynczej instancji z hero card, nawigacją zakładek (Gra / Mody / Logi / Profil) oraz dominującym przyciskiem uruchomienia.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/pages/InstanceView.tsx` — główna strona instancji
- `src/components/HeroCard.tsx` — duża karta instancji z nazwą, loaderem, przyciskiem Play (współdzielona z Dashboardem)
- `src/components/InstanceTabs.tsx` — underline tabs (styl VS Code)
- `src/router.tsx` (modyfikacja — route `/instance/:id`)

## Zależności
TASK-04 (nowy layout z sidebar), TASK-05

## Szczegóły implementacji
1. Route `/instance/:id` ładuje manifest instancji po `id` (nazwie folderu).
2. **HeroCard** (współdzielona z Dashboardem):
   - Duża karta z glassmorphism (`bg-card/80 backdrop-blur-xl`)
   - Nazwa instancji (duży font), wersja MC, loader badge
   - Dominujący przycisk "Uruchom" na pełną szerokość z purple glow (`shadow-purple-500/30`)
   - Subtelna animacja w tle: `@keyframes portal-pulse` — płynne przejścia przez odcienie fioletu
   - Menu akcji: przyciski ikonkami (Edytuj, Klonuj, Eksportuj, Otwórz folder, Usuń) w rzędzie pod nazwą
3. **InstanceTabs** — underline tabs (styl VS Code):
   - Cienka linia pod aktywną zakładką z fioletowym kolorem
   - Zakładki: Gra | Mody | Logi | Profil
   - Zakładka Gra jest domyślna
4. Każda zakładka renderuje swój komponent:
   - Gra: placeholder (TASK-13)
   - Mody: placeholder (TASK-20)
   - Logi: placeholder (TASK-26)
   - Profil: placeholder (TASK-27)
5. Stan aktywnej zakładki w URL (query param `?tab=mods`).
6. Jeśli instancja nie istnieje — `EmptyState` z przyciskiem powrotu.
7. **Logi jako dolny panel**: wysuwany od dołu panel (Sheet) stylizowany na terminal VS Code (`#1E1E1E`, monospace). Przycisk toggle w stopce strony. Wypełniany w TASK-26.

## Definition of Done
- Widok instancji ma HeroCard z przyciskiem Uruchom (purple glow).
- Underline tabs działają i stan jest w URL.
- Menu akcji zawiera wszystkie operacje na instancji.
- Dolny panel logów jest widoczny jako wysuwany terminal.
- Nieistniejąca instancja pokazuje EmptyState.
