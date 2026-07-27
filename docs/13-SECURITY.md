# 13 — Security

Threat model, controls, and the operational practices that keep them true over time.

**Depends on:** `06`, `07`, `10`. **Feeds into:** `15`, `16`, `17`.

---

## 1. Threat model

Assets, ranked by what actually hurts this business:

| # | Asset | Threat | Impact |
|---|---|---|---|
| A1 | Customer PII (name, phone, address) | Breach, scraping, insider access | Legal, reputational, physical safety (home addresses) |
| A2 | Payment integrity | Forged callbacks, replayed webhooks, tampered amounts, fake bank receipts | **Direct financial loss** |
| A3 | Order and stock data | Unauthorised modification, ransomware | Business paralysis |
| A4 | Admin access | Credential theft, phishing, session hijack | Total compromise |
| A5 | Product pricing | Tampering, parameter manipulation at checkout | Financial loss |
| A6 | Site availability | DDoS, resource exhaustion | Lost revenue |
| A7 | Brand reputation | Defacement, SEO spam injection, XSS | Long-term ranking damage |
| A8 | Bank receipt images | Exposure of customer bank details | Serious PII breach |

**Out of scope:** we never touch card data. All card handling is delegated to the acquiring bank's hosted page, keeping PCI DSS scope at SAQ-A.

**Primary adversaries:** opportunistic automated scanners (the overwhelming majority), credential-stuffing bots, COD fraudsters, fake-receipt fraudsters, and — the most likely single cause of a real incident — an honest staff member being phished.

---

## 2. Authentication

| Control | Specification |
|---|---|
| Password hashing | **Argon2id**, memory ≥ 19 MiB, iterations ≥ 2, parallelism 1. Never bcrypt-by-default, never MD5/SHA. |
| Password policy | ≥ 10 characters. No composition rules (they produce worse passwords). Checked against a breached-password corpus on set and change. |
| Legacy passwords | WordPress hashes are **not migrated**. Every existing customer resets on first login. |
| Enumeration | Registration, login and reset return identical messages and are timing-normalised. |
| Brute force | 5 attempts / 15 min per IP **and** per identifier. Account lock after 10 failures, with an email notification. |
| Session storage | Database-backed (not JWT) so sessions are revocable server-side. |
| Session cookie | `__Secure-` prefix, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. |
| Session lifetime | Customers: 30-day rolling. **Admin: 8-hour absolute, 30-minute idle.** |
| Session invalidation | Password change, email change, role change, or explicit revocation kills every session for that user. |
| Admin 2FA | **TOTP mandatory for `OWNER` and `MANAGER`**, enforced in middleware. Ten single-use recovery codes, hashed at rest, shown once. |
| OAuth | Google only. Provider-verified email required. Linking to an existing account requires proof of ownership. |
| Phone OTP | 6 digits, 5-minute TTL, hashed at rest, 3 verification attempts, 3 requests/hour/phone, 10/hour/IP. Blocked until an SMS provider is contracted. |
| Password reset | Single-use token, 60-minute TTL, hashed at rest, invalidated on use, sent only to a verified address. Reset invalidates all sessions. |
| Impersonation | Staff may **not** impersonate customers. If ever added, it must be OWNER-only, time-boxed, banner-visible, and audit-logged. |

---

## 3. Authorisation

| Control | Specification |
|---|---|
| Model | Permission-based (`resource:action`), never role-string comparison |
| Enforcement point | **The service layer.** A Route Handler and a Server Action calling the same service cannot diverge. |
| Default | Deny. A resource with no explicit permission check is unreachable. |
| Ownership | Capability (`order:read`) and ownership (this customer owns this order) are checked **separately**. Passing one never implies the other. |
| IDOR prevention | Public identifiers are non-sequential (cuid, `shortId`, `CC-YYMM-NNNN`). Every fetch-by-identifier re-checks ownership. |
| UI | Actions the user lacks permission for are **not rendered**. Never render-then-deny. |
| Admin surface | `/admin/*` is gated in `middleware.ts` before any route code runs. Optional IP allowlist via `ADMIN_IP_ALLOWLIST`. |
| Privilege escalation | Only `OWNER` may change roles. Nobody may elevate their own role. Every role change is audit-logged and emails the affected user. |
| Two-person rule | Bank-transfer approval above the configured threshold requires a second, higher-privileged actor. The requester can never approve. |

---

## 4. Input handling

| Vector | Control |
|---|---|
| **SQL injection** | Prisma parameterises everything. Raw SQL only via `$queryRaw` with tagged templates — string-concatenated SQL is a lint error and a review-blocking finding. |
| **XSS — stored** | Rich text is stored as **Tiptap JSON**, validated against an allowed node/mark schema, and rendered by a React renderer. **Raw HTML is never accepted or stored.** `dangerouslySetInnerHTML` is a lint error with a documented allowlist of zero. |
| **XSS — reflected** | React escapes by default. No `eval`, no `new Function`, no `innerHTML`. |
| **XSS — DOM** | CSP with nonces (§6). No inline event handlers. |
| **CSRF** | `SameSite=Lax` cookies + Auth.js CSRF tokens + Origin/Referer validation on every state-changing request. Server Actions carry Next.js's built-in action-ID protection. |
| **SSRF** | No user-supplied URL is ever fetched server-side. Outbound requests go only to an allowlist of provider hosts. Webhook URLs are not user-configurable. |
| **Mass assignment** | Every mutation input is an explicit Zod schema. `req.body` is never spread into a Prisma call. |
| **Parameter tampering** | Prices, discounts, shipping and totals are **always recomputed server-side from the database**. Client-supplied money values are ignored entirely. |
| **Path traversal** | No user input reaches a filesystem path. Object storage keys are server-generated. |
| **Prototype pollution** | No deep-merge of user input. JSON parsed into validated schemas. |
| **ReDoS** | No user input compiled into a regex. All validation patterns are constant and reviewed for catastrophic backtracking. |
| **Header injection** | Email addresses and names validated before use in headers; newlines stripped. |
| **Open redirect** | Post-login and post-payment redirects validated against a same-origin allowlist. |

---

## 5. File uploads

The highest-risk input surface, and it carries bank receipts.

| Control | Specification |
|---|---|
| Type validation | **Magic-byte sniffing**, never the file extension or the client `Content-Type` |
| Allowed | `image/jpeg`, `image/png`, `image/webp`, `image/avif`; plus `application/pdf` for receipts only |
| Size | 10 MB images, 20 MB receipts |
| Re-encoding | **Every image is re-encoded server-side with sharp.** This destroys embedded payloads (polyglots, EXIF-hidden scripts) as a side effect. |
| SVG | **Rejected outright.** SVG is a script execution vector. |
| EXIF | Stripped — GPS coordinates in a customer's photo are a privacy leak |
| Storage | Object storage, **never the application filesystem**. Server-generated keys; the user-supplied filename is stored as metadata only. |
| Serving | Product media via the CDN. **Bank receipts from a private bucket via short-lived (5-minute) signed URLs only** — never public, never CDN-cached. |
| Headers on user content | `Content-Disposition: attachment` where appropriate, `X-Content-Type-Options: nosniff`, and a separate origin for user-generated content if it ever becomes browsable |
| Rate limit | 20 uploads/hour/user |
| Malware | Checksum-based duplicate detection. Antivirus scanning is deferred; documented as accepted risk given re-encoding and the private-bucket policy. |
| Direct upload | Presigned PUT with a short expiry, a content-length range, and a content-type condition |

---

## 6. Transport and headers

Set in `middleware.ts` and at the CDN.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Nonce-based. `default-src 'self'`; `script-src 'self' 'nonce-{n}' 'strict-dynamic' https://www.googletagmanager.com`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https://cdn.citycomputer.com.np https://www.google-analytics.com`; `connect-src` limited to self + analytics + Sentry; `frame-src` limited to payment gateways and the Google Maps embed; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self' https://epay.esewa.com.np https://khalti.com`; `object-src 'none'`; `upgrade-insecure-requests` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (belt and braces with `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-site` |
| `X-Robots-Tag` | `noindex, nofollow` on all non-production environments **and** on `/admin`, `/account`, `/checkout` |

**CSP rollout:** deploy in `Content-Security-Policy-Report-Only` with a reporting endpoint for two weeks, review the report volume, then enforce. Enforcing a hand-written CSP on day one always breaks something.

---

## 7. Payment security

Restating the hard rules from `10 §6` because they are security controls, not just correctness controls:

| # | Control |
|---|---|
| S1 | **A browser callback is never proof of payment.** Settlement requires a server-to-server lookup or a signature-verified webhook that triggers one. |
| S2 | Signatures are computed over the **raw request body**, before parsing. |
| S3 | Webhook timestamps outside a 5-minute window are rejected (replay protection). |
| S4 | Provider transaction IDs are deduplicated in the database, not in memory. |
| S5 | The looked-up amount must **exactly** equal the server-computed order total. Any mismatch fails the payment and raises an alert. |
| S6 | `intentReference` is unique — the database enforces payment idempotency. |
| S7 | Gateway secrets exist only in environment variables, never in the database, never in client code, never in logs. |
| S8 | Request and response payloads are stored with secrets, keys and signatures redacted. |
| S9 | An `AMBIGUOUS` provider status is never auto-settled. |
| S10 | Bank-receipt approval requires a human, a second human above the threshold, and an explicit instruction to verify against the bank statement rather than the image. Duplicate receipt images are detected by checksum. |
| S11 | No community npm payment SDK is used. |
| S12 | Refunds require a reason, an approver distinct from the requester, and an evidence attachment. |

---

## 8. Rate limiting and abuse

Redis sliding window, keyed by IP + user + endpoint class. Full table in `07 §2`. Additional controls:

| Vector | Control |
|---|---|
| Credential stuffing | Per-identifier limits, breached-password checks, lockout, and Cloudflare bot management |
| Scraping | Cloudflare bot management; aggressive limits on `/api/v1/products` and `/api/v1/suggest`; no bulk-export endpoint is public |
| COD fraud | Value cap, phone OTP, `codBlocked` flag, per-address velocity limits, refusal-rate monitoring (`10 §7`) |
| Fake receipts | Checksum duplicate detection, two-person approval, bank-statement verification requirement |
| Review spam | Verified-purchase preference, moderation queue, rate limit, honeypot |
| Enquiry spam | Honeypot field, minimum time-on-form, rate limit. **No CAPTCHA at launch** — Cloudflare Turnstile is the escalation if abuse appears. |
| Coupon abuse | Per-customer usage limits, first-order-only flag, atomic redemption inside the order transaction |
| Inventory denial | Stock reserved at **order placement**, not add-to-cart; short TTLs; velocity limits |
| Resource exhaustion | Query complexity limits, `perPage` capped at 100, statement timeouts, background processing for anything > 5 s |

---

## 9. Secrets management

| Rule | Detail |
|---|---|
| Never in the repository | Enforced by `gitleaks` in CI **and** a pre-commit hook |
| Storage | Host secret manager (Vercel environment variables, or Docker secrets / SOPS-encrypted files on a VPS). Never a plain `.env` on a production disk. |
| Access | Production secrets: `OWNER`-equivalent human access only. Staging secrets are always distinct from production. |
| Rotation | Quarterly for `AUTH_SECRET`, storage keys and API tokens. **Immediately** on any staff departure or suspected exposure. A documented runbook exists. |
| `.env.example` | Every variable listed and documented, no real values, checked in |
| Validation | Zod at boot. The app refuses to start with a missing or malformed variable. |
| Client exposure | Only `NEXT_PUBLIC_*` reaches the browser. A secret carrying that prefix is a CI failure. |
| Logs | A Pino redaction list covers `password`, `token`, `secret`, `signature`, `authorization`, `cookie`, `otp`, `pidx`, and every provider key. |

---

## 10. Audit logging

| Aspect | Specification |
|---|---|
| What | Every admin mutation: create, update, delete, status transition, price change, stock adjustment, payment approval, refund, role change, login, failed login, session revocation, settings change, data export |
| Fields | Actor ID, actor email (denormalised — the log survives user deletion), action, entity type, entity ID, before, after, IP, user agent, timestamp, request ID |
| Immutability | **`UPDATE` and `DELETE` are revoked on `audit_logs` at the database role level.** The application cannot modify history even if compromised. |
| Retention | 3 years minimum |
| Access | `OWNER` only, surfaced as "Activity History" in plain language (`09 §13`) |
| Alerting | Real-time alerts on: role changes, bulk deletes, payment approvals above a threshold, settings changes, and > 5 failed admin logins in 10 minutes |
| Related append-only tables | `StockMovement`, `OrderStatusEvent`, `PaymentEvent`, `BuildRevision` — same DB-level immutability |

---

## 11. Dependency and supply-chain security

| Control | Detail |
|---|---|
| Lockfile | `pnpm-lock.yaml` committed; `--frozen-lockfile` in CI |
| Audit | `pnpm audit` on every PR. **High or critical severity fails the build.** |
| Automated updates | Dependabot or Renovate, grouped, weekly, with auto-merge only for patch-level updates that pass the full test suite |
| Review | Any new direct dependency requires: maintenance check (commit in the last 12 months), download volume, bundle-size impact, transitive dependency count, and licence |
| Prohibited | Unmaintained packages (> 18 months) in any security-relevant path; any community payment SDK |
| Secret scanning | `gitleaks` in CI and pre-commit |
| SAST | `eslint-plugin-security` + CodeQL on every PR |
| Container | Trivy scan on the built image; base image pinned by digest and refreshed monthly |
| SBOM | Generated per release and archived |
| Provenance | CI builds are the only source of production artefacts. No local builds are ever deployed. |

---

## 12. Infrastructure

| Control | Detail |
|---|---|
| TLS | 1.2 minimum, 1.3 preferred. Automated certificate renewal with expiry monitoring. |
| Database | Not publicly reachable. TLS-required connections. Least-privilege application role — **no `SUPERUSER`, no `DROP`, no `UPDATE`/`DELETE` on append-only tables.** A separate migration role holds DDL rights. |
| Redis | Password-protected, not publicly reachable, TLS where supported |
| Object storage | Buckets private by default. Product media served through the CDN with signed-origin access. **Receipts never public.** |
| WAF | Cloudflare managed rules + OWASP core ruleset, rate limiting, bot management, and country-level challenge rules if abuse warrants |
| DDoS | Cloudflare proxy on every record. The origin IP is never exposed in DNS. |
| SSH (VPS option) | Key-only, no root login, no password auth, non-standard port, `fail2ban`, unattended security upgrades |
| Backups | See §13 |
| Monitoring | Uptime checks from multiple regions; alerts on error rate, latency, failed payments, and failed jobs |

---

## 13. Backup and disaster recovery

| Objective | Target |
|---|---|
| **RPO** (maximum acceptable data loss) | **15 minutes** |
| **RTO** (maximum acceptable downtime) | **4 hours** |

### Backup schedule

| Asset | Method | Frequency | Retention | Location |
|---|---|---|---|---|
| PostgreSQL | Continuous WAL archiving + PITR | Continuous | 30 days PITR | Managed provider, or off-host on a VPS |
| PostgreSQL | Full logical dump (`pg_dump -Fc`) | Nightly | 30 daily, 12 monthly | **A different provider from the primary** |
| Object storage | Cross-region replication or a nightly `rclone` sync | Nightly | 30 days + versioning | Second region/provider |
| Redis | Not backed up | — | — | Cache and queue only; rebuildable. The `Job` table is the durable queue of record. |
| Secrets | Encrypted export, offline | On change | Current + 3 prior | Owner's password manager |
| Code | Git, with a mirror | On push | Indefinite | GitHub + mirror |

### Non-negotiable rules

1. **A backup that has not been restored is not a backup.** An automated nightly job restores the previous dump into an ephemeral database, runs integrity assertions (row counts, order total sums, `StockLevel` vs `StockMovement` reconciliation), and **alerts on failure**. A silently broken backup chain is the most common cause of catastrophic data loss.
2. Backups live with a **different provider** from the primary database. Same-provider backups do not survive an account suspension.
3. Backups are encrypted at rest with a key stored separately.
4. A **full restore drill is performed quarterly**, timed, and the result recorded in `docs/runbooks/restore.md`. If the drill exceeds the RTO, the RTO or the process changes — not the documentation.

### Disaster scenarios

| Scenario | Response | Target |
|---|---|---|
| Bad deploy | Instant rollback to the previous release (`15 §7`) | < 5 min |
| Data corruption from a bad migration | PITR to just before the migration | < 2 h |
| Accidental mass delete by an admin | PITR + replay of `AuditLog` to identify scope | < 2 h |
| Database host outage | Failover to a replica, or restore to a new instance | < 4 h |
| Full provider outage | Restore from the off-provider backup to the secondary host; DNS repoint | < 4 h |
| Ransomware / account compromise | Rotate every credential, restore from an immutable backup, forensic review of `AuditLog` | < 8 h |
| Object storage loss | Restore from replication; product images regenerate from originals | < 4 h |

Each has a runbook in `docs/runbooks/`. Runbooks are written **before** they are needed and updated after every incident.

---

## 14. Incident response

| Phase | Actions |
|---|---|
| **Detect** | Sentry alerts, uptime alerts, failed-payment-rate alerts, audit-log alerts, customer reports |
| **Triage** | Severity 1 (data breach, payment compromise, full outage) → immediate. Sev 2 (partial outage, security bug) → same day. Sev 3 → next sprint. |
| **Contain** | Disable the affected feature via a feature flag, revoke sessions, rotate credentials, block IPs at the WAF |
| **Eradicate** | Fix, test, deploy |
| **Recover** | Restore service, verify data integrity, monitor closely for 48 h |
| **Review** | Blameless post-mortem within 5 working days: timeline, root cause, contributing factors, actions with owners and dates. Filed in `docs/runbooks/`. |
| **Notify** | If personal data is exposed: notify affected customers promptly and plainly, describing what happened, what data, what to do, and what we changed. Obtain legal advice on statutory obligations. |

**Contacts, escalation path, and provider support numbers live in `docs/runbooks/incident.md` and are reviewed quarterly.**

---

## 15. Privacy by design

| Principle | Implementation |
|---|---|
| Data minimisation | Collect only what fulfils an order. No date of birth, no gender, no national ID. |
| Purpose limitation | Marketing consent is separate from an order. |
| Retention | Enforced by scheduled jobs, not by intention (`12 §11`) |
| Access | Customers can view and export their own data |
| Erasure | An account-deletion request anonymises personal fields while retaining orders for legal and accounting purposes. Documented in the privacy policy. |
| Encryption | TLS in transit; provider-level encryption at rest; `twoFactorSecret` additionally application-encrypted |
| Staff access | Role-limited. `STAFF` sees what they need to fulfil an order and no more. Every access to customer data through admin search is logged. |
| Third parties | A documented list of every processor (Cloudflare, host, Resend, Sentry, Google, Meta, TikTok, Microsoft, payment providers) with the data each receives, published in the privacy policy. |

---

## 16. Security testing

| Type | Frequency | Tool |
|---|---|---|
| SAST | Every PR | ESLint security plugin, CodeQL |
| Dependency audit | Every PR + weekly | `pnpm audit`, Dependabot |
| Secret scanning | Every commit | `gitleaks` |
| Container scan | Every build | Trivy |
| DAST | Pre-release | OWASP ZAP baseline against staging |
| Auth/authz tests | Every PR | Automated: every protected route asserts 401/403 for anonymous and wrong-role actors |
| Payment security tests | Every PR | Forged callback rejected · replayed webhook ignored · amount-mismatch refused · duplicate `intentReference` blocked · unsigned request rejected |
| Upload tests | Every PR | Polyglot file rejected · SVG rejected · oversized rejected · extension-spoofed rejected |
| Penetration test | Before launch, then annually | External, scoped to auth, payments, admin, and IDOR |
| Access review | Quarterly | Who has admin, who has production secrets, who has database access |

---

## 17. Pre-launch security checklist

- [ ] All default and seed credentials removed; no test accounts in production
- [ ] 2FA enrolled for every `OWNER` and `MANAGER` account
- [ ] All security headers verified live (securityheaders.com grade A or better)
- [ ] CSP enforcing, with report-only findings resolved
- [ ] TLS A+ (SSL Labs), HSTS preload submitted
- [ ] Database not reachable from the public internet
- [ ] Object storage buckets private; receipts confirmed unreachable without a signed URL
- [ ] Rate limits verified on auth, checkout, payment and upload endpoints
- [ ] Every protected route returns 401/403 for anonymous and wrong-role actors (automated)
- [ ] Payment forged-callback, replay and amount-mismatch tests pass against sandbox
- [ ] Audit logging verified immutable at the database permission level
- [ ] Backup restore drill completed successfully within RTO
- [ ] Secrets rotated from any value used during development
- [ ] `gitleaks` clean on the full repository history
- [ ] Dependency audit clean of high and critical findings
- [ ] External penetration test completed and all high findings remediated
- [ ] Privacy policy and terms reviewed by a lawyer
- [ ] Incident runbook written, with contacts confirmed
- [ ] `SECURITY.md` published with a disclosure contact
