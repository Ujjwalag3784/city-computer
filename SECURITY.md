# Security Policy

Full threat model and controls are documented in `docs/13-SECURITY.md`. This
file covers reporting and the baseline that's enforced in code.

## Reporting a vulnerability

Do not open a public GitHub issue for a suspected vulnerability. Email the
maintainer directly with a description and reproduction steps. Aim to
acknowledge within 48 hours.

## Baseline enforced in this repository

- **Secrets:** never committed. `.env.example` documents every variable with
  no real values (the eSewa keys in it are public sandbox test credentials,
  not secrets). Real secrets live in `.env.local` (gitignored) or the hosting
  provider's secret manager. CI runs gitleaks on every PR
  (`docs/15-DEVOPS-CICD.md`).
- **Env validation:** all `process.env` access is centralized in
  `src/env.ts`, which Zod-validates on boot and refuses to start if anything
  is missing or malformed.
- **Logging:** `src/lib/logger.ts` redacts passwords, tokens, secrets,
  signatures, cookies, OTPs, and payment `pidx` values before anything is
  written to logs (`docs/13-SECURITY.md §9`).
- **Errors:** `src/lib/errors.ts` guarantees that unexpected exceptions are
  converted to a generic, safe message before reaching the client — stack
  traces, SQL, and provider internals are never leaked
  (`toSafeAppError`).
- **Rich text:** `dangerouslySetInnerHTML` is prohibited repo-wide via an
  ESLint rule. Rich content must be rendered from validated JSON
  (`docs/13-SECURITY.md §4`).
- **Dependencies:** `npm audit` / equivalent runs in CI; the `security`
  ESLint plugin runs on every lint pass.
- **Payments:** all gateway callbacks (eSewa, Khalti, Fonepay, connectIPS)
  are server-side verified against the provider before an order is marked
  paid — never trusted from client redirects alone (`docs/10-PAYMENTS-NEPAL.md`).

## Supported versions

Only the `main` branch is supported. There are no maintained release
branches at this stage of the project.
