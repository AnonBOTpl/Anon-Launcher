# TASK-02 — Konfiguracja shadcn/ui

## Cel
Integracja biblioteki komponentów shadcn/ui z projektem, umożliwiająca użycie gotowych komponentów w interfejsie.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `components.json`
- `src/lib/utils.ts`
- `src/styles/globals.css`
- `tailwind.config.ts` (lub `postcss.config.js`)
- `src/components/ui/` (katalog z komponentami shadcn — Button, Card, Dialog, Input, Select itp.)

## Zależności
TASK-01

## Szczegóły implementacji
1. Zainstaluj Tailwind CSS v4 z PostCSS oraz autoprefixer.
2. Skonfiguruj `tailwind.config.ts` z rozszerzeniem dla shadcn (ciemny motyw, border radius, kolory).
3. Dodaj globalne style CSS z definicjami Tailwind oraz shadcn CSS variables w `src/styles/globals.css`.
4. Zaimportuj globalne style w `src/main.tsx`.
5. Utwórz `src/lib/utils.ts` z funkcją `cn()` do łączenia klas Tailwind (clsx + tailwind-merge).
6. Zainicjuj shadcn/ui komendą `npx shadcn@latest init`.
7. Dodaj podstawowe komponenty: Button, Card, Dialog, Input, Select, Label, Badge, Separator, Tabs, ScrollArea, Sheet, DropdownMenu, Avatar.
8. Zweryfikuj że komponenty renderują się poprawnie w aplikacji.

## Definition of Done
- Komponenty shadcn/ui są dostępne w `src/components/ui/`.
- Globalne style Tailwind z motywem shadcn są załadowane.
- `cn()` działa i jest używany w komponentach.
- Motyw jasny/ciemny jest skonfigurowany.
