# Indeks Tasków — Uniwersalny Launcher Minecraft (MVP)

| # | Nazwa | Etap | Zależności |
|---|---|---|---|
| **TASK-01** | Inicjalizacja projektu Tauri + React + TypeScript | etap-01-fundament | Brak |
| **TASK-02** | Konfiguracja shadcn/ui | etap-01-fundament | TASK-01 |
| **TASK-03** | System manifestów instancji (ze schemaVersion) | etap-01-fundament | TASK-01 |
| **TASK-04** | Podstawowy Dashboard | etap-01-fundament | TASK-02, TASK-03 |
| **TASK-05** | Tworzenie instancji | etap-02-instancje | TASK-03 |
| **TASK-06** | Klonowanie instancji | etap-02-instancje | TASK-05 |
| **TASK-07** | Eksport i import ZIP | etap-02-instancje | TASK-05 |
| **TASK-08** | Otwieranie folderu instancji | etap-02-instancje | TASK-05 |
| **TASK-30** | Usuwanie instancji | etap-02-instancje | TASK-05 |
| **TASK-31** | Edycja ustawień instancji | etap-02-instancje | TASK-05 |
| **TASK-32** | Widok instancji (layout z zakładkami) | etap-02-instancje | TASK-04, TASK-05 |
| **TASK-09** | Microsoft Device Code Flow | etap-03-logowanie-java | TASK-01 |
| **TASK-10** | Integracja Stronghold + obsługa wielu kont | etap-03-logowanie-java | TASK-09 |
| **TASK-11** | Moduł pobierania Java (Adoptium) | etap-03-logowanie-java | TASK-01 |
| **TASK-12** | Integracja minecraft-java-core | etap-04-minecraft-core | TASK-03, TASK-11 |
| **TASK-13** | Uruchamianie Vanilla | etap-04-minecraft-core | TASK-12, TASK-11, TASK-10 |
| **TASK-14** | Integracja Fabric | etap-04-minecraft-core | TASK-12 |
| **TASK-15** | Tryb offline (cached session) | etap-04-minecraft-core | TASK-10, TASK-13 |
| **TASK-16** | Kolejka pobrań | etap-05-download-manager | TASK-01 |
| **TASK-17** | Monitorowanie postępu | etap-05-download-manager | TASK-16 |
| **TASK-18** | Pobieranie assetów i bibliotek | etap-05-download-manager | TASK-16, TASK-12 |
| **TASK-19** | Wyszukiwarka modów | etap-06-modrinth | TASK-12 |
| **TASK-20** | Instalacja modów | etap-06-modrinth | TASK-19, TASK-16 |
| **TASK-21** | Aktualizacja modów | etap-06-modrinth | TASK-20 |
| **TASK-22** | Wykrywanie zależności | etap-06-modrinth | TASK-20 |
| **TASK-23** | Snapshoty | etap-07-stabilnosc | TASK-05 |
| **TASK-24** | Przywracanie poprzedniego stanu | etap-07-stabilnosc | TASK-23 |
| **TASK-25** | Obsługa crash-reportów | etap-07-stabilnosc | TASK-13 |
| **TASK-26** | Logi w czasie rzeczywistym | etap-07-stabilnosc | TASK-13 |
| **TASK-27** | Avatar 2D w zakładce Profil | etap-08-ui-ux | TASK-10 |
| **TASK-28a** | Responsywność i stany UI | etap-08-ui-ux | TASK-04, TASK-05, TASK-19, TASK-26, TASK-27 |
| **TASK-28b** | Motywy, animacje, accessibility | etap-08-ui-ux | TASK-28a |
| **TASK-28c** | Toasty i notyfikacje | etap-08-ui-ux | TASK-28a |
| **TASK-29** | Testy końcowe | etap-08-ui-ux | TASK-01 do TASK-28c |