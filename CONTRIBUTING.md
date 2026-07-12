# Contributing to AnonLauncher 🚀

Thank you for considering contributing to AnonLauncher! Here's how to get started.

## Code of Conduct

By participating, you agree to abide by the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be respectful, constructive, and inclusive.

## How to Contribute

### 🐛 Reporting Bugs

1. **Search existing issues** first — someone may have already reported it.
2. If not found, [open a new issue](https://github.com/AnonBOTpl/Anon-Launcher/issues/new).
3. Include:
   - AnonLauncher version (top of Settings or from `tauri.conf.json`)
   - Minecraft version and loader
   - Steps to reproduce
   - What you expected vs what happened
   - Screenshots / console logs (if applicable)

### 💡 Feature Requests

Open an issue with the `enhancement` label. Describe:
- What you want to achieve
- Why it's useful
- Any implementation ideas

### 🔧 Pull Requests

1. **Fork** the repository.
2. **Create a branch**: `git checkout -b feature/my-feature` or `fix/my-bug`.
3. **Make your changes** following the conventions below.
4. **Test locally**:
   ```bash
   npx tsc --noEmit        # Check TypeScript
   cd src-tauri && cargo check  # Check Rust
   ```
5. **Commit** with a clear message (see [Conventional Commits](https://www.conventionalcommits.org/)).
6. **Push** and open a Pull Request.

## Development Setup

```bash
# Prerequisites: Node.js >= 18, Rust >= 1.70, npm >= 9
git clone https://github.com/AnonBOTpl/Anon-Launcher.git
cd Anon-Launcher
npm install
npm run tauri dev    # Hot-reload dev mode
```

## Code Conventions

### TypeScript / React

- **Strict mode** enabled — `noUncheckedIndexedAccess` is on.
- **Prefer hooks** over class components. Use `useCallback` / `useMemo` for performance.
- **Import order:** React → libraries → internal modules (~ `@/`).
- **No `any`** — use `unknown` if the type is truly dynamic.
- **CSS:** Use Tailwind utility classes. Avoid inline styles.

### Rust

- **Clippy** lints are enforced — run `cargo clippy` before committing.
- **Naming:** `snake_case` for functions/variables, `PascalCase` for types.
- **Errors:** Use the project's `ManifestError` type where applicable.
- **Commands:** All Tauri commands use `#[serde(rename_all = "camelCase")]`.
- **Events:** Tauri events use `:` separator, e.g. `modpack:progress`.

### All Languages

- **Test your code** where feasible. Rust `#[cfg(test)] mod tests { }` is appreciated.
- **No hardcoded secrets**, paths, or tokens in code.
- **i18n:** All user-facing strings must go through `useTranslation()` or `i18n.t()`.

## Project Structure

```
src/              # Frontend (React + TypeScript)
  components/     # UI components
  hooks/          # Custom React hooks
  lib/            # Business logic
  pages/          # Page components
  types/          # TypeScript types
  locales/        # i18n translations (en.json, pl.json)
src-tauri/        # Backend (Rust)
  src/
    lib.rs        # Entry point + command registration
    instance_manager.rs
    mod_installer.rs
    minecraft_core.rs
    ...
```

## Questions?

Open a [discussion](https://github.com/AnonBOTpl/Anon-Launcher/discussions) or an issue.
