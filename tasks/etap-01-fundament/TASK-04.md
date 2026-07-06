# TASK-04 — Dashboard z Sidebarem (redesign)

## Cel
Główny widok aplikacji z bocznym paskiem nawigacyjnym, siatką instancji w nowoczesnym stylu glassmorphism oraz hero card dla wybranej instancji.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/components/Sidebar.tsx` — wąski pasek boczny (64px) z ikonami
- `src/components/AppLayout.tsx` — layout: sidebar + content
- `src/pages/Dashboard.tsx` — główna strona z hero card + grid
- `src/components/InstanceCard.tsx` — nowoczesna karta z glassmorphism
- `src/components/InstanceGrid.tsx` — siatka kart
- `src/components/HeroCard.tsx` — duża karta głównej/wybranej instancji z przyciskiem Uruchom
- `src/App.tsx` (modyfikacja — użycie AppLayout)
- `src/router.tsx`
- `src/hooks/useInstances.ts`
- `src/styles/globals.css` — paleta kolorów: #0F172A, fiolet A855F7, glassmorphism

## Zależności
TASK-02, TASK-03

## Szczegóły implementacji
1. **Sidebar (64px)**: logo na górze, ikony nawigacji (Dashboard, Instancje, Modrinth — placeholder), avatar konta na dole. Ciemne tło, hover z fioletowym akcentem. Węższy niż standardowy sidebar — tylko ikony, bez tekstu.
2. **AppLayout**: wrapper wokół stron — `Sidebar | <main>`. Używany w routerze jako layout dla wszystkich stron.
3. **Dashboard**: 
   - Hero card: duża karta pierwszej/wybranej instancji (nazwa, MC wersja, loader, RAM), dominujący przycisk "Uruchom" (pełna szerokość, purple glow na hover).
   - Poniżej: grid mniejszych kart instancji (InstanceGrid).
   - Pusty stan z informacją i CTA.
4. **InstanceCard**: nowoczesna karta z glassmorphism (`bg-card/80 backdrop-blur-xl`), zaokrąglone rogi (16px), subtelny border, ikonka loadera, hover z purple border glow. Przycisk "⋯" z menu (Klonuj, Eksportuj, Usuń).
5. **InstanceGrid**: responsywna siatka, 1 kolumna na małych, 2-4 na dużych.
6. **Paleta kolorów** w `globals.css`:
   - Tło: `#0F172A` (slate-900), karty: `#1E293B/80` (slate-800 z przezroczystością dla glassmorphism)
   - Akcent: fiolet Nether `#A855F7` → hover `#C084FC`
   - Tekst: biały `#F8FAFC`, muted: `#94A3B8`
   - Border radius: `--radius: 14px`
   - Glassmorphism: `backdrop-blur-xl`, `bg-opacity-80`

## Definition of Done
- Sidebar jest widoczny z ikonami nawigacji i avatarem.
- Dashboard ma hero card z przyciskiem Uruchom.
- Siatka instancji w glassmorphism stylu.
- Przycisk "⋯" na karcie zawiera menu akcji.
- Paleta kolorów odpowiada specyfikacji (slate + fiolet).
- Wszystkie istniejące funkcje Dashboardu działają.
