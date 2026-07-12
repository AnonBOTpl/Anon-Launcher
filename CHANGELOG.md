# Changelog

## v0.1.6 (2026-07-12)

### 🚀 New — SettingsPage (Full-Screen Settings)

- **Full-screen settings page** at `/settings` replacing the modal dialog
- **Sections:** Language, Theme (Dark/Light), Accent Color (8 presets), Java Runtime Manager, Updates, About
- **Responsive layout:** Fills entire window width, Java versions in `auto-fill minmax(260px,1fr)` grid, accent colors in `grid-cols-4 sm:grid-cols-8`
- **Java Manager:** Lists all available Java versions from Adoptium API with install status and Download button
- **Updates:** Manual check against GitHub Releases, shows "up to date" or "update available" with download link
- **About:** App version, GitHub link, Releases link
- **Sidebar:** Settings button navigates to `/settings` with active state indicator

### 🔧 Bug Fixes

- **NeoForge Java path:** Instead of falling back to system Java (`"java"` on PATH), the launcher now auto-downloads the required Java version from Adoptium before running the NeoForge installer
- **Missing locale keys:** Restored 9 keys that were incorrectly removed as "dead" but actually used in code:
  - `loader.neoforgeVersion` / `fabricVersion` — HeroCard, InstanceCard badge labels
  - `edit.javaMismatch` — Java version mismatch warning in EditInstanceDialog
  - `clone.description` — CloneInstanceDialog description
  - `export.description` — ExportInstanceDialog description
  - `import.confirmDesc` — ImportInstanceDialog confirm step
  - `content.count` / `content.noItems` — ContentList counters and empty state
  - `modDetails.installed` — "Installed" badge in ModSearch

### 🎬 Animations — Full System (6 types)

- **Page transitions:** Smooth fade-in + slide-up (0.4s) on every page navigation — Dashboard, InstanceView, CreateInstance, SettingsPage all fade in with a subtle upward motion
- **Staggered cards:** Dashboard instance cards cascade in one by one with 80ms delay, slight scale-up (0.97→1) for a wave effect
- **Accent color morph:** CSS transitions (0.3s) on HTML element make theme/accent changes buttery smooth
- **Launch pulse:** Pulsing box-shadow glow on the launch button while the game is starting up
- **Sidebar micro-interactions:** Nav icons scale up (×1.10) on hover and bounce (×0.95) on click — tactile feedback
- **Dark/Light mode transition:** Smooth 0.3s color transition when toggling between dark and light themes

### 🎨 UI Improvements

- **SettingsPage:** Reduced Theme and Accent section sizes, responsive accent grid (4 cols → 8 cols on wider screens)
- **SettingsPage:** Content now fills entire window (removed `max-w-2xl` constraint)

---

## v0.1.5 (2026-07-11)

### 🚀 New — Import from Link (TASK-37)

- **ImportFromLinkDialog:** Paste a Modrinth URL to import a modpack directly — parses `modrinth.com/modpack/slug`, fetches project details, shows preview with icon/name/version selector, then installs via background thread with progress events
- **Dashboard button:** New "From link" button with link icon between "New" and "Import ZIP"
- **Direct installation:** Uses existing `create_instance_from_modpack` backend — no redirect to create page, stays in dialog through install/done/error states

### 🚀 New — Accent Color System

- **8 accent presets:** Purple (default), Blue, Sky, Emerald, Amber, Rose, Pink, Slate — stored in `localStorage` as `anon_accent_hue`
- **Dark mode aware:** `applyAccentHue()` checks `.dark` class and uses different lightness values (dark: `L=18%`, light: `L=95%`)
- **SettingsDialog:** New Appearance section with Dark/Light toggle cards + 4-column accent color grid with color swatches and labels
- **FirstRunWizard:** Step 2 accent picker now works — replaced "Coming in a future update" placeholder with live color swatches
- **Sidebar:** Active nav item now uses `text-primary`/`bg-primary/15` instead of hardcoded purple
- **Theme toggle fix:** All three theme toggle locations (Settings, Wizard, Sidebar) now re-apply accent CSS vars when toggling dark/light mode

### 🚀 New — Cancel Button (Modpack Installation)

- **ImportFromLinkDialog:** Added Cancel button during modpack installation — user can abort mid-way
- **Backend integration:** Calls existing `cancel_modpack_installation` Tauri command which sets AtomicBool flag
- **File cleanup:** Backend deletes the partially created instance directory and temp files when cancelled
- **Clean UX:** Cancelling resets to URL input state (no error shown), shows "Cancelling..." status during abort

### 🔧 Bug Fixes

- **Theme classes (full codebase):** Converted ALL hardcoded `purple-*` Tailwind classes to `primary-*` across ~50 files using batch sed replacement — accent color now affects every UI element including buttons, spinners, gradients, active states, hover effects, and fallback icons
- **Animation colors:** Changed `rgba(168, 85, 247, ...)` → `hsl(var(--primary) / ...)` in `portal-pulse` and `running-glow` CSS animations — glow effects now use the selected accent color
- **Gradient buttons:** Fixed `from-primary to-primary` → `from-primary to-primary/80` to restore subtle gradient effect on buttons (was solid color after conversion)
- **Wizard account step:** After successful Microsoft login, the account is now properly saved via `saveAccount()` — multiple accounts can be added and displayed in the wizard
- **Wizard account list:** Step 3 now shows ALL saved accounts with active/inactive state — click an inactive account to switch active account via `switchAccount()`
- **Dashboard refresh after import:** Added `onImported` callback to `ImportFromLinkDialog` — Dashboard now refreshes instance list after modpack installation completes
- **Dark mode accent visibility:** Fixed invisible label/checkmark on dark backgrounds — `applyAccentHue` now uses dark-appropriate CSS var values
- **Modal dismiss block:** ImportFromLinkDialog now blocks closing on outside click during preview and installing steps
- **Error handling:** `saveAccount` in wizard uses `.catch().finally()` to ensure account list refreshes even if backend save fails

---

## v0.1.4 (2026-07-11)

### 🚀 New — Quick Play

- **Quick Play on HeroCard:** Connect to any Minecraft server directly from the instance HeroCard — just paste an IP and click "▶"
- **Server history:** Last 10 servers per instance saved to localStorage, displayed as clickable buttons with hover ▶ and X remove
- **Modern Minecraft support:** Uses `--quickPlayMultiplayer "ip:port"` (Mojang's system for 1.20.5+) instead of legacy `--server`/`--port`
- **Clean UI:** IP input field with purple accent, history badges with hover effects, disabled state while game is running

### 🚀 New — First Run Wizard

- **3-step welcome wizard** on first launch (flagged in localStorage as `anon_first_run_done`):
  1. 🌐 **Language** — Grid of 6 available locales (EN, PL, DE, JA, FR, ES), changes i18n immediately
  2. 🎨 **Theme** — Dark/Light selection with visual cards, accent color placeholder
  3. 🔐 **Account** — Shows active Microsoft session badge if logged in, or login/skip options
- **Glassmorphism overlay:** Full-screen backdrop blur, animated step transitions
- **App icon:** Loaded from `src-tauri/icons/icon.png` via Rust command with proper `object-contain` rendering
- **Dynamic locales:** `AVAILABLE_LOCALES` array in `i18n.ts`
- **SettingsDialog:** Now uses `AVAILABLE_LOCALES` instead of hardcoded English/Polish options

### 🚀 New — NeoForge Loader Support

- **NeoForge instance creation:** Full support for creating and launching NeoForge Minecraft instances
- **NeoForge installer (Rust):** `neoforge_installer.rs` — event-based background installer
- **NeoForge version fetching:** `fetchAllNeoForgeVersions()` from `maven.neoforged.net` Maven API
- **Zero-click modpack installation:** NeoForge modpacks from Modrinth (.mrpack) install correctly
- **Mod search for NeoForge instances:** Mods tab searches with `categories:neoforge` for NeoForge instances
- **Shader guidance for NeoForge:** Shaderpacks tab shows Oculus + Embeddium guidance
- **Interface lock during gameplay:** Health-check thread polling PID every 5s

### 🔧 Bug Fixes
- **Theme cards inverted:** Dark/Light selection in the wizard was backwards
- **Cmd window flashing (release builds):** Added `creation_flags(0x08000000)` to `tasklist` and `taskkill`

---

## v0.1.3 (2026-07-10)

### 🏗️ Project
- **Public repository:** Reopened the GitHub repository as public for community access
- **Privacy policy:** Added `PRIVACY.md` + configured Microsoft Entra App Registration with privacy URL
- **Contributing guide:** Added `CONTRIBUTING.md` with code conventions and PR workflow
- **Security policy:** Added `SECURITY.md` with vulnerability disclosure process

### 🐛 Bug Fixes
- **Instance name validation:** Prevented creating instances with duplicate names — added real-time uniqueness check in the form + Rust-side guard
- **Update checker:** Works again now that the repo is public (GitHub API returns 404 for private repos)
- **Fabric launch (CSP):** Fixed "Failed to fetch" on release builds — added `https://meta.fabricmc.net` to Content Security Policy
- **Auto-download Java:** Launch button no longer blocked when Java is missing — auto-downloads required Java version during launch flow
- **Modpack Polish strings:** Changed all hardcoded Polish progress messages in Rust backend (modpack installer + core downloader) to English for consistent i18n
- **Screenshot thumbnails:** Replaced broken `convertFileSrc()` with a Rust command that reads files as base64 — screenshots now display correctly
- **Screenshot viewer:** Clicking a screenshot thumbnail now opens a full-size modal with filename header and open-folder button

### 🔧 Maintenance
- **Audit progress:** 7/10 pre-release fixes completed (up from 5/10 in v0.1.2)

---

## v0.1.2 (2026-07-10)

### 🛡️ Security
- **CSP:** Added Content Security Policy to prevent XSS attacks (mod descriptions from Modrinth)
- **Stronghold:** Replaced hardcoded vault password with a randomly generated key per installation
- **Access tokens:** Moved from `localStorage` to Rust backend file storage (OS-protected), no longer XSS-accessible via WebView
- **Zip Slip:** Added path traversal protection when importing ZIP files and modpacks

### 🎨 Performance
- **Screenshots:** Replaced Base64 data URIs with Tauri's native `asset://` protocol — no more CPU/memory overhead for thumbnail loading
- **SHA1 verification:** All downloaded files (libraries, assets, modpack files) are now verified against their SHA1 hash before writing to disk, preventing corrupt downloads

### 🐛 Bug Fixes
- **Update All:** Fixed "Update All" button not disappearing after mods are updated — added `recheckCounter` to force re-check + refs for fresh mod data
- **Update All:** Added cancel button during bulk update so users can abort mid-way
- **Snapshot modal:** Fixed modal hidden behind stacking context — ported to `document.body` via React portal
- **Mod list refresh:** Mod list now re-fetches updates after "Update All" completes
- **Content tabs:** Fixed tab switching between Resource Packs and Shaders — added `key` prop to force React remount
- **HTML descriptions:** Resource pack and shader descriptions now render with proper HTML formatting (like mods)
- **Sodium dependency:** Installing Iris Shaders now also installs Sodium automatically
- **Iris banner:** Updated text to mention both Iris and Sodium
- **Modpack description:** Modpack selection now shows full HTML-formatted project description
- **Form submission:** Fixed "Show more" button accidentally submitting the modpack creation form (missing `type="button"`)

### 🔧 Maintenance
- **DRY:** Extracted duplicate `sanitize_name` function from 11 files into a shared `sanitize.rs` module with unit tests
- **Asset protocol:** Configured `assetProtocol` scope for serving local files
- **Shared HTML sanitizer:** Extracted `sanitizeHtml()` from `ModSearch.tsx` into shared `html-sanitizer.ts` for reuse across mods, resource packs, shaders, and modpacks

---

## v0.1.1 (2026-07-10)

### 🐛 Bug Fixes
- **Asset download progress bar:** Fixed progress bar stuck at 0% during parallel asset downloads — added a reporter thread that emits progress every 200ms

### ⚡ Performance
- **Parallel asset downloads:** 8 concurrent threads with atomic progress counter

---

## v0.1.0 (2026-07-10) — First public build

### 🚀 Features
- **NSIS installer:** Custom graphics, MIT license, per-user install mode
- **Instance management:** Create, clone, export/import ZIP, edit, delete Minecraft instances
- **Vanilla & Fabric:** Full support for loading both Vanilla and Fabric (auto-downloads Fabric Loader)
- **Modrinth integration:** Search, install, update, and manage mods, resource packs, and shaders
- **Modpack installation:** Install Fabric modpacks from Modrinth (.mrpack) with progress tracking
- **Authentication:** Microsoft OAuth2 login with PKCE + device code flow
- **Java management:** Auto-download Java 8/11/17/21/25 from Adoptium API
- **Snapshot system:** Create full or metadata-only snapshots with restore capability
- **Process manager:** Launch, stop, monitor Minecraft processes with real-time log streaming
- **Game console:** Real-time log viewer with filtering, color coding, warnings/errors highlighting
- **Detached console window:** Undock the game console into a separate window
- **Screenshot viewer:** Automatic screenshot thumbnails in the instance overview
- **Update checker:** Automatic GitHub Releases update detection with banner
- **NSIS installer:** Custom graphics, license page, per-user installation

### 🔧 Technical
- **Tauri v2 + React 19 + shadcn/ui:** Modern desktop app architecture
- **TypeScript + Rust:** Hybrid approach — TypeScript resolves Minecraft metadata, Rust handles downloads and process management
- **Stronghold encryption:** Refresh tokens stored in encrypted vault
- **SHA1 verification:** Library downloads verified against Minecraft's SHA1 hashes
- **Process management:** Orphan process detection, timeout-safe PID checks
- **Full i18n:** English + Polish (PL) translations with i18next
- **Dark theme:** Default dark mode with purple Nether accent
- **Error resilient:** `catch_unwind` in all background threads, graceful error handling in UI
