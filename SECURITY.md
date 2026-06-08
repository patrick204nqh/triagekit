# Security Policy

triagekit is a security-triage tool, so its own security posture matters.

## The token model

- **Your token is never embedded.** It is pasted at **runtime** in the dashboard's
  Settings, stored only in the browser's **`sessionStorage`** (cleared when the tab
  closes), and is never read at build time or written into the generated HTML.
- **No backend, no third-party scripts.** The dashboard is a single self-contained HTML
  file. It talks only to the configured provider's API origin, enforced by a strict
  hash-based **Content-Security-Policy** computed at build time (`default-src 'none'`;
  `script-src` allows only the inlined script by its `sha256` hash; `connect-src` is
  limited to the provider's API).
- **Use a least-privilege token.** Prefer a **fine-grained personal access token** scoped
  to only the repositories you triage, with the minimum read permissions for the resources
  you load (Dependabot alerts, code scanning, pull requests, issues).
- Never paste a token into a tracked file, a screenshot, a commit, or a public build.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | ✅ |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub's **private vulnerability reporting**: go to the
repository's **Security** tab → **Report a vulnerability**. This opens a private advisory
visible only to the maintainer.

Please include a description, reproduction steps, affected version, and impact. You can
expect an acknowledgement within a few days; fixes are released as a new version with a
note in the [CHANGELOG](CHANGELOG.md).
