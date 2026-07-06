# TASK-03 — System manifestów instancji (ze schemaVersion)

## Cel
Stworzenie systemu manifestów dla instancji Minecraft, z obsługą wersjonowania schematu (`schemaVersion`), mechanizmem migracji oraz typowaniem TypeScript i strukturą Rust.

## Warstwa
Obie (Frontend + Backend)

## Pliki do utworzenia / modyfikacji
- `src/types/instance.ts` — typy manifestu w TypeScript
- `src/lib/manifest.ts` — walidacja, migracja, serializacja manifestu
- `src-tauri/src/manifest.rs` — struktury Rust dla manifestu
- `src-tauri/src/manifest_migration.rs` — logika migracji schematu
- `src-tauri/src/instance_manager.rs` — podstawowy menedżer instancji (CRUD manifestów)

## Zależności
TASK-01

## Szczegóły implementacji
1. Zdefiniuj TypeScript interface `InstanceManifest` zawierający: `schemaVersion`, `name`, `mcVersion`, `loader`, `loaderVersion`, `javaVersion`, `ram`, `createdAt`, `updatedAt`.
2. Zdefiniuj analogiczną strukturę w Rust z `serde::Serialize`/`Deserialize`.
3. Zaimplementuj funkcję `migrateManifest()` która na podstawie `schemaVersion` wykonuje kolejne migracje (initial schema version = 1).
4. Każda migracja to osobna funkcja transformująca manifest z wersji N na N+1.
5. Zaimplementuj funkcje `readManifest(path)` i `writeManifest(path)` w TypeScript.
6. W Rust zaimplementuj odpowiedniki do odczytu/zapisu manifestu na dysku.
7. Dodaj pole `schemaVersion` jako wymagane — każdy manifest bez tego pola jest odrzucany przy odczycie.
8. Zdefiniuj ścieżkę przechowywania instancji (np. `$APP_DATA/instances/<nazwa>/instance.json`).

## Definition of Done
- Manifest z `schemaVersion: 1` jest zapisywany i odczytywany poprawnie.
- Próba odczytu manifestu bez `schemaVersion` zwraca błąd.
- Mechanizm migracji jest gotowy do rozszerzania o nowe wersje schematu.
- Typy TypeScript i Rust są zgodne.
