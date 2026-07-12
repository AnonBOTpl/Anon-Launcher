# Security Policy

## Supported Versions

We provide security updates for the latest stable release only.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active |
| < 0.1   | ❌ |

## Reporting a Vulnerability

AnonLauncher handles Microsoft authentication tokens and Minecraft session data. If you discover a security vulnerability, **please do NOT open a public issue**.

Instead, report it privately by emailing or opening a **draft security advisory** on GitHub:

1. Go to [github.com/AnonBOTpl/Anon-Launcher/security/advisories](https://github.com/AnonBOTpl/Anon-Launcher/security/advisories)
2. Click **"New draft security advisory"**
3. Fill in the details

You can expect:
- **Acknowledgment** within 48 hours
- **Regular updates** on progress every 7 days
- **Credit** in the release notes once the fix is published (unless you prefer to remain anonymous)

## What We've Done

- **Stronghold encryption:** All refresh tokens are encrypted using Argon2 + XChaCha20-Poly1305.
- **CSP:** Content Security Policy restricts script and connection sources.
- **Access tokens:** Stored on the Rust backend (OS-protected), not in localStorage.
- **SHA1 verification:** All downloaded files are verified before writing to disk.
- **Zip Slip protection:** Path traversal attacks are prevented during ZIP import.

## Scope

The following are considered **out of scope**:

- Vulnerabilities in older, unsupported versions
- Social engineering attacks against users
- Physical access attacks
- Denial of service against Modrinth or Mojang APIs

## Responsible Disclosure

We kindly ask you to give us reasonable time to fix and release a patch before disclosing the vulnerability publicly.
