# TASK-15 — Tryb offline (cached session)

## Cel
Implementacja trybu offline — gdy token wygasł lub brak połączenia z internetem, launcher uruchamia grę z ostatnio zapamiętanym profilem.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/lib/offline.ts` — logika trybu offline
- `src-tauri/src/offline.rs` — backend trybu offline
- `src-tauri/src/launcher.rs` (modyfikacja — użycie cached session)
- `src/components/OfflineBanner.tsx` — pasek informujący o trybie offline
- `src/hooks/useOnlineStatus.ts`

## Zależności
TASK-10, TASK-13

## Szczegóły implementacji
1. Cached session: przy każdym udanym logowaniu (TASK-09) zapisz kopię sesji (username, uuid) w plaintext (bez tokenów) w `$APP_DATA/cached_session.json`.
2. Przy uruchomieniu gry (TASK-13) spróbuj odświeżyć token z Stronghold. Jeśli odświeżenie się nie powiedzie (network error, expired refresh token), użyj cached session z flagą `offline: true`.
3. W trybie offline wygeneruj argument `--username <cached_username>` i `--uuid <cached_uuid>` dla Minecrafta. Pomiń argumenty związane z autoryzacją (access token).
4. UI: `OfflineBanner` — żółty pasek u góry aplikacji z komunikatem "Tryb offline — gra uruchomiona bez weryfikacji konta".
5. `useOnlineStatus` — hook monitorujący stan połączenia (navigator.onLine + okresowy ping).
6. Przy starcie aplikacji: sprawdź czy token aktywnego konta jest nadal ważny. Jeśli nie, spróbuj odświeżyć. Jeśli się nie uda, włącz tryb offline.
7. W trybie offline nie pokazuj przycisku "Zaloguj" jako jedynej opcji — pozwól uruchomić grę z cached session.

## Definition of Done
- Gra uruchamia się w trybie offline z cached session (username, uuid).
- Żółty banner informuje użytkownika o trybie offline.
- Po przywróceniu połączenia, launcher próbuje odświeżyć token.
- Uruchomienie bez cached session w trybie offline pokazuje błąd.
