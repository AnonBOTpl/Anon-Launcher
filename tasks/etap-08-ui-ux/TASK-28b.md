# TASK-28b — Motywy, animacje, accessibility, portal glow

## Cel
Animacje premium (portal glow, fade-in, micro-interakcje), przełącznik motywu jasny/ciemny, dostępność klawiaturowa.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/styles/globals.css` — keyframes animacji, portal glow, focus ring
- `src/hooks/useTheme.ts` — przełącznik motywu (slate-50 / #0F172A)
- `src/components/ui/button.tsx` — dodanie purple glow wariantu
- Wszystkie strony i komponenty (przegląd i poprawki animacji/a11y)

## Zależności
TASK-28a

## Szczegóły implementacji

### 1. Portal Glow — kluczowa animacja
```css
@keyframes portal-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(168,85,247,0.3); }
  50% { box-shadow: 0 0 40px rgba(168,85,247,0.6), 0 0 60px rgba(139,92,246,0.3); }
}

@keyframes portal-gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```
Użycie: przycisk "Uruchom" ma `portal-pulse`, hero card ma subtelny `portal-gradient` w tle.

### 2. Animacje
- **Fade-in**: karty instancji wjeżdżają z dołu z opacity (staggered delay)
- **Hover glow**: przyciski i karty mają purple shadow na hover
- **Micro-interakcje**: scale(0.98) na kliknięcie, border glow na focus
- **Sidebar**: smooth slide dla tooltipów, active indicator transition
- **Page transitions**: fade między stronami (opcja w routerze)

### 3. Motyw jasny/ciemny
- Ciemny: `#0F172A` (główny)
- Jasny: `#F8FAFC` (slate-50) z zachowaniem fioletowego akcentu
- Przełącznik w sidebarze (na dole, obok avatara)
- Preferencja zapamiętana w localStorage
- Start: localStorage → `prefers-color-scheme`

### 4. Accessibility
- Focus ring: fioletowy (`ring-2 ring-primary`)
- Wszystkie akcje przez Tab/Enter/Escape
- Skip to main content link
- ARIA labels na ikonach w sidebarze
- Kontrast: spełnia WCAG AA (biały tekst na #0F172A)

### 5. Responsywność sidebara (z TASK-28a)
- Sidebar na desktop: 64px, widoczny zawsze
- Na mobile: floating action button z ikoną menu, rozwijany drawer

## Definition of Done
- Animacja portal-pulse działa na przycisku Uruchom.
- Karty mają fade-in z opóźnieniem.
- Przełącznik motywu działa i jest zapamiętywany.
- Focus ring jest fioletowy i widoczny.
- Wszystkie akcje są dostępne z klawiatury.
- Sidebar jest responsywny.
