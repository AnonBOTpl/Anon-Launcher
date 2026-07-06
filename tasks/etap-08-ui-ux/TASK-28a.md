# TASK-28a — Redesign UI: paleta, glassmorphism, stany, responsywność

## Cel
Pełny redesign wizualny aplikacji: nowa paleta kolorów (slate + fiolet Nether), glassmorphism, sidebar layout, stany UI i responsywność.

## Warstwa
Frontend (React/TS) — głównie CSS + komponenty layoutu

## Pliki do utworzenia / modyfikacji
- `src/styles/globals.css` — **główna zmiana**: paleta #0F172A, fiolet A855F7, glassmorphism
- `src/components/AppLayout.tsx` — layout sidebar + content
- `src/components/Sidebar.tsx` — wąski pasek boczny (64px)
- `src/components/EmptyState.tsx` — z fioletowym akcentem
- `src/components/LoadingSkeleton.tsx` — glassmorphism skeleton
- `src/components/ErrorBoundary.tsx`
- `src/components/ErrorFallback.tsx`
- Wszystkie strony (przegląd — dostosowanie do nowej palety)

## Zależności
TASK-04, TASK-05, TASK-19, TASK-26, TASK-27

## Szczegóły implementacji

### 1. Paleta kolorów — `globals.css`
```css
:root {
  --background: #0F172A;        /* slate-900 */
  --card: #1E293B / 0.8;        /* slate-800 z przezroczystością */
  --popover: #1E293B;
  --primary: #A855F7;           /* purple-500 — Nether portal */
  --primary-foreground: #F8FAFC;
  --accent: #A855F7;
  --muted: #1E293B;
  --muted-foreground: #94A3B8;  /* slate-400 */
  --border: rgba(148, 163, 184, 0.15);
  --radius: 14px;
  --ring: #A855F7;
}
```
Glassmorphism: karty mają `backdrop-blur-xl`, `bg-card/80`, subtelny border z `rgba(255,255,255,0.05)`.

### 2. Sidebar (z TASK-04) — finalne dopracowanie
- Tooltipy pod ikonami (nazwy stron)
- Responsywność: na małych ekranach sidebar zwija się do浮动 przycisku
- Active indicator: fioletowa kreska obok aktywnej ikony

### 3. Stany UI
- **LoadingSkeleton**: glassmorphism karty z `animate-pulse`, fioletowy shimmer
- **EmptyState**: ikona + komunikat + CTA, wszystkie w nowej palecie
- **ErrorBoundary/ErrorFallback**: czerwony akcent, przycisk "Spróbuj ponownie" z fioletowym hover

### 4. Responsywność
- Sidebar: 64px na desktop, floating FAB na mobile (<768px)
- Siatka instancji: 1→2→3→4 kolumny
- Dialogi i modale: pełna szerokość na mobile

## Definition of Done
- `globals.css` zawiera nową paletę (slate #0F172A + fiolet #A855F7).
- Karty mają glassmorphism (backdrop-blur, przezroczystość).
- Sidebar jest dopracowany z tooltipami i aktywnym indykatorem.
- Wszystkie stany UI (loading, empty, error) działają w nowej palecie.
- Aplikacja jest responsywna (mobile → desktop).
