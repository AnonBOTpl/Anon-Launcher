# TASK-22 — Wykrywanie zależności

## Cel
Implementacja wykrywania, wyświetlania i instalacji zależności modów z Modrinth, wraz z obsługą brakujących modów wymaganych przez inne mody.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/dependency_resolver.rs` — rozwiązywanie zależności
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/dependency-resolver.ts` — frontend API
- `src/hooks/useDependencies.ts`
- `src/components/DependencyList.tsx` — lista zależności
- `src/components/MissingDepsWarning.tsx` — ostrzeżenie o brakujących zależnościach

## Zależności
TASK-20

## Szczegóły implementacji
1. Przy instalacji moda (TASK-20): pobierz listę zależności z API Modrinth (`GET /v2/version/<versionId>` → pole `dependencies`).
2. Dla każdej zależności: sprawdź czy jest już zainstalowana w instancji (szukaj w `mods.json` i folderze `mods/`).
3. Jeśli brakuje zależności: wyświetl listę brakujących modów, zaproponuj instalację wszystkich wymaganych.
4. Zależności cykliczne: wykryj i przerwij z błędem.
5. Opcjonalne zależności: oznacz jako opcjonalne, nie blokuj instalacji.
6. Komenda `resolve_dependencies(instanceName, modVersionId)` — zwraca pełne drzewo zależności z statusem (zainstalowane / do zainstalowania / konflikt).
7. UI: `MissingDepsWarning` — dialog przed instalacją moda, lista zależności z przyciskiem "Zainstaluj wszystkie".
8. `DependencyList` — w widoku szczegółów moda (TASK-19) pokazuje zależności i ich status.

## Definition of Done
- Przy instalacji moda launcher wykrywa jego zależności.
- Brakujące zależności są wyświetlane z opcją instalacji.
- Zależności opcjonalne są oznaczone.
- Zależności cykliczne są wykrywane i blokowane.
- Po zainstalowaniu zależności, mod główny działa poprawnie.
