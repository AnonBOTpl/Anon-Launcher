# TASK-30 — Usuwanie instancji

## Cel
Umożliwienie użytkownikowi usunięcia instancji wraz z jej katalogiem i manifestem, z obowiązkowym potwierdzeniem i ostrzeżeniem o utracie danych.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/components/DeleteInstanceDialog.tsx`
- `src-tauri/src/instance_manager.rs` (modyfikacja — dodanie `delete_instance`)
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/pages/Dashboard.tsx` (modyfikacja — dodanie opcji "Usuń" do karty instancji)

## Zależności
TASK-05

## Szczegóły implementacji
1. Dodaj opcję "Usuń instancję" do menu kontekstowego karty instancji na Dashboardzie (np. dropdown z `⋯` lub menu prawego przycisku myszy).
2. Kliknięcie "Usuń" otwiera `DeleteInstanceDialog` — modal z ostrzeżeniem: "Usunięcie instancji jest nieodwracalne. Zostaną usunięte wszystkie pliki, mody i zapisane gry. Wpisz nazwę instancji aby potwierdzić: [input]".
3. Potwierdzenie wymaga wpisania nazwy instancji (case-sensitive). Przycisk "Usuń" jest nieaktywny dopóki nazwa nie zgadza się z aktualną nazwą instancji.
4. Backend Rust: komenda `delete_instance(instance_name: String)` usuwa cały katalog instancji rekursywnie (`std::fs::remove_dir_all`).
5. Po pomyślnym usunięciu: zamknij modal, odśwież listę instancji na Dashboardzie, wyświetl toast "Instancja [nazwa] została usunięta".
6. Obsłuż błędy: instancja aktualnie uruchomiona (nie pozwól usunąć), błąd systemu plików (wyświetl komunikat).

## Definition of Done
- Opcja "Usuń" jest dostępna dla każdej instancji na Dashboardzie.
- Dialog wymaga wpisania nazwy instancji przed potwierdzeniem.
- Katalog instancji jest usuwany z dysku po potwierdzeniu.
- Lista instancji odświeża się po usunięciu.
- Uruchomiona instancja nie może być usunięta.
- Toast potwierdza usunięcie.
