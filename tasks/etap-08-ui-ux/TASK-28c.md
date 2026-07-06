# TASK-28c — Toasty i notyfikacje

## Cel
Integracja systemu powiadomień (toastów) dla wszystkich akcji użytkownika w aplikacji, zapewniająca feedback dla operacji takich jak tworzenie/usuwanie instancji, instalacja modów, snapshoty.

## Warstwa
Frontend (React/TS)

## Pliki do utworzenia / modyfikacji
- `src/components/ui/` (modyfikacje — dodanie konfiguracji Sonner)
- Wszystkie miejsca wywołujące akcje (przegląd i dodanie toastów)

## Zależności
TASK-28a

## Szczegóły implementacji
1. Zintegruj shadcn/Sonner jako system toastów w aplikacji.
2. Każda akcja użytkownika wyświetla toast:
   - Tworzenie instancji → "Instancja [nazwa] utworzona"
   - Usunięcie instancji → "Instancja [nazwa] usunięta"
   - Klonowanie → "Instancja [nazwa] sklonowana"
   - Eksport/Import ZIP → "Eksport zakończony" / "Import zakończony"
   - Mod zainstalowany → "Mod [nazwa] zainstalowany"
   - Mod odinstalowany → "Mod [nazwa] odinstalowany"
   - Błąd → "Błąd: [komunikat]" (czerwony toast)
   - Snapshot → "Snapshot utworzony" / "Snapshot przywrócony"
3. Toasty mają timeout (domyślnie 4s), błędy nie znikają automatycznie.
4. Sukces = zielony, błąd = czerwony, informacja = niebieski.
5. Skonfiguruj pozycję toastów (bottom-right).

## Definition of Done
- System toastów jest zintegrowany z aplikacją.
- Każda akcja użytkownika daje feedback przez toast.
- Błędy wyświetlają czerwone toasty które nie znikają automatycznie.
- Sukcesy wyświetlają zielone toasty z timeoutem 4s.
