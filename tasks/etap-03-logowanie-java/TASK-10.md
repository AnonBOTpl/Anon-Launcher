# TASK-10 — Integracja Stronghold + obsługa wielu kont

## Cel
Bezpieczne przechowywanie tokenów sesji Microsoft przy użyciu Tauri Plugin Stronghold oraz implementacja przełączania wielu kont Microsoft w UI.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src-tauri/src/stronghold.rs` — inicjalizacja i operacje na Stronghold
- `src-tauri/src/account_manager.rs` — zarządzanie wieloma kontami
- `src-tauri/src/commands.rs` (modyfikacja)
- `src/lib/accounts.ts` — API dla frontendu do zarządzania kontami
- `src/hooks/useAccounts.ts`
- `src/components/AccountSwitcher.tsx` — dropdown w headerze
- `src/components/AccountManagerDialog.tsx` — zarządzanie kontami
- `src-tauri/Cargo.toml` (modyfikacja — dodanie zależności stronghold)
- `src-tauri/tauri.conf.json` (modyfikacja — rejestracja pluginu Stronghold)

## Zależności
TASK-09

## Szczegóły implementacji
1. Zainstaluj i skonfiguruj `tauri-plugin-stronghold` w projekcie Tauri.
2. Zaimplementuj `AccountManager` w Rust: przechowuje mapę `<uuid, AccountData>` gdzie `AccountData` zawiera `username`, `uuid`, `refreshToken` (szyfrowany w Stronghold).
3. Operacje: `save_account(account)`, `load_account(uuid)`, `list_accounts()`, `delete_account(uuid)`, `set_active_account(uuid)`.
4. Stronghold: przechowuj refresh token w secure vault, metadane kont (username, uuid) w plaintext dla szybkiego listowania.
5. Frontend: `AccountSwitcher` — dropdown w headerze z listą zapisanych kont, zaznaczeniem aktywnego, opcją "Zarządzaj kontami".
6. `AccountManagerDialog` — lista kont z przyciskiem "Dodaj konto" (uruchamia flow z TASK-09), przyciskiem "Usuń" dla każdego konta, oznaczeniem aktywnego konta.
7. Komunikacja: frontend woła komendy Tauri do zarządzania kontami, backend zwraca dane.
8. Przy starcie aplikacji: wczytaj ostatnio aktywne konto i odśwież token jeśli wygasł.

## Definition of Done
- Tokeny są przechowywane w Stronghold (szyfrowane).
- Można dodać wiele kont Microsoft.
- Dropdown w headerze pozwala przełączać aktywne konto.
- Po restarcie aplikacji aktywne konto jest zapamiętane.
- Usunięcie konta usuwa jego tokeny z Stronghold.
