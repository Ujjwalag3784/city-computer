# 15 — DevOps & CI/CD

Git workflow, environments, pipeline, containers, deployment and rollback.

**Depends on:** `03 §9`, `04`, `13`. **Feeds into:** `17`, `18`.

---

## 1. Git workflow

**Trunk-based with short-lived branches**, not GitFlow. GitFlow's release branches solve a problem this project does not have (versioned software shipped to customers) and add ceremony this team cannot afford.

```
main ──────●───────●───────●───────●──────►  always deployable, protected
            ╲     ╱ ╲     ╱ ╲     ╱
             ●───●   ●───●   ●───●            feature branches, ≤ 3 days
```

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Always deployable, always green | Production (manual promote) |
| `develop` | Integration branch | Staging (automatic) |
| `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `perf/*`, `test/*` | Work in progress | Ephemeral preview per PR |
| `hotfix/*` | Branched from `main`, merged to `main` and back to `develop` | Production after expedited review |

### Rules

| Rule | Detail |
|---|---|
| Branch naming | `type/short-kebab-description` — `feat/pc-builder-power-model` |
| Lifetime | ≤ 3 days. A longer branch means the work was not sliced properly. |
| Commits | Conventional Commits, enforced by commitlint: `feat(builder): add PSU connector matching` |
| Rebase, don't merge | Feature branches rebase onto `develop`; merged with squash |
| `main` protection | No direct pushes. Requires: 1 approving review, all checks green, up to date with base, signed commits, linear history. |
| Force push | Never on `main` or `develop` |
| Tags | `v1.4.0` on every production release, semver, with generated release notes |

### Pull request requirements

Template requires: what changed and why · linked issue · screenshots or a recording for UI changes · `EXPLAIN ANALYZE` for queries touching > 1,000 rows · a migration plan for schema changes · a `docs/` update if documented behaviour changed · a completed self-review checklist.

**A PR that changes behaviour described in `docs/` without updating `docs/` is rejected.**

---

## 2. Environments

| Env | Branch | Database | Payments | Analytics | Indexable | Purpose |
|---|---|---|---|---|---|---|
| **local** | any | Docker Postgres, seeded | Sandbox | Disabled | n/a | Development |
| **preview** | any PR | Ephemeral or shared preview DB | Sandbox | Disabled | No (auth + `X-Robots-Tag`) | Review the change |
| **staging** | `develop` | Anonymised production copy | Sandbox | Separate GA4 property | **No** (Basic auth + `X-Robots-Tag` at the edge) | UAT, load tests, migration rehearsal |
| **production** | `main` | Production | Live | Live | Yes | Live |

### Non-negotiables

1. **Staging data is an anonymised copy of production.** Names, phones, emails and addresses are scrambled by a documented, tested script. Real customer data never leaves production.
2. **Staging is unreachable by crawlers** — HTTP Basic auth plus `X-Robots-Tag: noindex, nofollow` at the edge (a meta tag alone does not cover JSON, images or PDFs).
3. **Every environment has distinct secrets.** A production key must never appear in a staging configuration.
4. **Every migration runs against a restored production snapshot in staging before it reaches production.**

---

## 3. Local development

```bash
git clone … && cd citycomputer
pnpm install
cp .env.example .env.local          # fill in the values the README lists
docker compose up -d                # postgres, redis, minio, meilisearch, mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Ten commands or fewer, per `04 §8`. Companion scripts:

| Script | Purpose |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm typecheck` · `pnpm lint` · `pnpm format` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm e2e` · `pnpm e2e:ui` | Playwright |
| `pnpm db:migrate` · `db:seed` · `db:reset` · `db:studio` | Database |
| `pnpm analyze` | Bundle analyzer |
| `pnpm lighthouse` | Local Lighthouse run |

`mailpit` catches all outbound email locally — no real email is ever sent from a development machine.

### Pre-commit hooks (husky + lint-staged)

Format · lint changed files · typecheck · `gitleaks` secret scan · commitlint. Deliberately fast — under 10 seconds — so nobody is tempted to `--no-verify`.

---

## 4. CI pipeline

`.github/workflows/ci.yml` — runs on every PR and every push to `develop`/`main`.

```
┌──────────────┐
│   install    │  pnpm --frozen-lockfile, cached
└──────┬───────┘
       ├──────────────┬──────────────┬──────────────┬──────────────┐
       ▼              ▼              ▼              ▼              ▼
 ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │typecheck │  │   lint   │  │  unit    │  │ security │  │  build   │
 │  tsc     │  │eslint +  │  │ vitest   │  │gitleaks  │  │next build│
 │--noEmit  │  │prettier  │  │+coverage │  │pnpm audit│  │+ bundle  │
 │          │  │+ copy-   │  │          │  │CodeQL    │  │  budget  │
 │          │  │  lint    │  │          │  │          │  │          │
 └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
      └─────────────┴─────────────┴─────────────┴─────────────┘
                                  ▼
                    ┌─────────────────────────────┐
                    │  integration (services up)  │
                    │  postgres + redis           │
                    │  migrate → seed → test      │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  e2e (Playwright, 3 shards) │
                    │  + axe accessibility        │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │  lighthouse ci (mobile)     │
                    └──────────────┬──────────────┘
                                   ▼
                            ✔ all green → mergeable
```

### Gates — all blocking

| Gate | Threshold |
|---|---|
| TypeScript | Zero errors, `strict` |
| ESLint | Zero errors, zero warnings |
| **Copy lint** | No forbidden admin vocabulary (`09 §2.1`) in `messages/*.json` |
| Unit coverage | ≥ 80% overall; **≥ 95% on `server/services/payment`, `server/services/pricing`, `server/services/builder/rules`, `server/services/order`** |
| Integration | All pass |
| E2E | All critical journeys pass |
| Accessibility | Zero axe violations on every tested route |
| Security | Zero high/critical dependency findings; `gitleaks` clean; CodeQL clean |
| Bundle budget | No route over budget; no route regressed > 5% |
| Lighthouse | Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95 |
| Migration safety | A lint step flags destructive DDL and requires an explicit `ALLOW_DESTRUCTIVE` label on the PR |

**Target: full pipeline under 12 minutes.** A slow pipeline gets bypassed.

---

## 5. Docker

Multi-stage build, distroless-style runtime, non-root.

```dockerfile
# 1. deps    — pnpm install --frozen-lockfile
# 2. builder — prisma generate, next build (standalone output)
# 3. runner  — node:22-alpine, non-root user, only .next/standalone + static + public
```

| Practice | Detail |
|---|---|
| Base image | Pinned by digest, refreshed monthly |
| Output | `output: 'standalone'` in `next.config.ts` — dramatically smaller image |
| User | Non-root (`nextjs:nodejs`, uid 1001) |
| Health check | `HEALTHCHECK` hitting `/api/health` |
| Secrets | Runtime environment variables only. **Never `ARG`, never baked in.** Build-time public variables are explicitly allowlisted. |
| Scanning | Trivy on every build; high/critical findings fail |
| Size target | < 250 MB |
| Layer caching | Dependencies before source, so a source change does not reinstall |

`docker-compose.yml` runs the full stack — app, postgres, redis, minio, meilisearch, mailpit, caddy — and is maintained as a **first-class deliverable regardless of hosting choice**, per `03 §9`. It is the portability guarantee.

---

## 6. Deployment

### Path A — Vercel (recommended for launch)

| Stage | Action |
|---|---|
| PR opened | Automatic preview deployment with a unique URL, an ephemeral or branch database, and Basic auth |
| Merge to `develop` | Automatic deploy to staging; migrations run in a pre-deploy step |
| Merge to `main` | Build and deploy to production **behind a manual promote gate** |
| Promote | A human approves in the GitHub Actions environment; the build is promoted |
| Post-deploy | Automated smoke tests against production; Sentry release created with source maps; sitemap ping |

### Path B — VPS with Docker Compose

| Stage | Action |
|---|---|
| Merge to `main` | Build image in CI → push to GHCR tagged with the commit SHA and `latest` |
| Deploy | SSH to the host → `docker compose pull` → run migrations in a one-off container → start the new container alongside the old |
| Health gate | Poll `/api/health` on the new container until healthy or a 60 s timeout |
| Switch | Caddy reverse-proxy switches upstream; old container drains for 30 s, then stops |
| Rollback | Re-tag the previous SHA and repeat — under 2 minutes |

### Migration policy — both paths

1. **Migrations run before the new code deploys**, and must be backwards-compatible with the currently running version. This is what makes rollback safe.
2. Destructive changes follow expand → migrate → contract across **separate releases** (`06 §13.1`).
3. Any migration expected to exceed 5 s runs as a background backfill, not blocking DDL. Indexes are created `CONCURRENTLY`.
4. **A full backup is taken immediately before every production migration**, and the migration does not proceed until the backup is confirmed.
5. Rollback is a new corrective migration, never `migrate resolve --rolled-back` against live data.

### Zero-downtime requirements

Stateless application · graceful shutdown draining in-flight requests · database-compatible with both the old and new code for the duration of the deploy · connection pooling that tolerates restarts · a static maintenance page served by Cloudflare if a hard window is ever unavoidable.

---

## 7. Rollback

| Trigger | Action | Target time |
|---|---|---|
| Error rate > 5% for 5 min | Automatic alert, manual rollback decision | 5 min |
| Checkout completion drops > 20% | Immediate rollback | 5 min |
| Payment failures spike | Disable the affected gateway via the settings flag **first** (no deploy needed), then investigate | 1 min |
| Core Web Vitals regression | Roll back at the next opportunity | — |
| Bad migration | PITR restore to just before the migration | < 2 h |

**Feature flags are the first line of defence.** Any risky feature — a new payment provider, the builder's auto-build, a new checkout step — ships behind a flag in `Setting`, so it can be disabled from the admin in seconds without a deploy. That is faster and safer than any rollback.

Rollback is rehearsed in staging quarterly. An untested rollback is not a rollback.

---

## 8. Monitoring and alerting

| Layer | Tool | Alerts |
|---|---|---|
| Errors | Sentry | New issue in production · error rate spike · regression on a resolved issue |
| Uptime | Better Stack, multi-region, 1 min | Site down · `/api/health` degraded · TLS expiring within 14 days |
| Logs | Pino → Better Stack | Error-level log volume spike · specific patterns (payment verification failure, stock drift) |
| Performance | Vercel Analytics / custom | p95 latency > 2× target · CWV field regression |
| Database | Provider metrics | Connections > 80% · slow queries · disk > 80% · replication lag |
| Business | Custom checks | Zero orders in 6 h during business hours · payment success rate < 90% · failed jobs > 10 · **backup verification failed** |
| Security | Custom | Failed admin logins > 5 in 10 min · role change · payment approval over threshold · WAF block spike |

### Alert routing

| Severity | Channel | Response |
|---|---|---|
| **P1** — site down, payments broken, data breach | Phone + SMS + email | Immediate |
| **P2** — degraded, one gateway failing, job backlog | Email + Slack | Within 2 h |
| **P3** — warnings, budget breaches | Daily digest | Next working day |

**Every alert must be actionable.** An alert nobody acts on is deleted, not muted — muted alerts train people to ignore the ones that matter.

### Health endpoint

`GET /api/health` returns `200` with per-dependency status (database, Redis, storage, queue depth) and `503` if any critical dependency is down. Used by the load balancer, uptime monitoring, and the container health check. It is never cached and never exposes version or configuration detail publicly.

---

## 9. Release process

| Step | Action |
|---|---|
| 1 | Confirm `develop` is green and staging UAT is signed off |
| 2 | Open a release PR `develop → main`; review the changelog |
| 3 | Merge; tag `vX.Y.Z`; generate release notes from Conventional Commits |
| 4 | **Take and verify a production backup** |
| 5 | Run migrations |
| 6 | Promote the deployment |
| 7 | Run smoke tests: home, category, PDP, add to cart, checkout to payment redirect (sandbox), admin login, health endpoint |
| 8 | Watch Sentry and business metrics for 30 minutes |
| 9 | Announce internally; update the changelog |

### Release cadence

Weekly during active development, on a fixed day, never on a Friday and never before a holiday. Hotfixes ship any time with an expedited review, and are always merged back to `develop`.

---

## 10. Operational runbooks

Written **before** they are needed, stored in `docs/runbooks/`, and updated after every incident.

| Runbook | Covers |
|---|---|
| `incident.md` | Severity definitions, escalation, contacts, provider support numbers, communication templates |
| `restore.md` | Full database restore, PITR to a point in time, object storage restore, verification steps, last drill result |
| `payment-reconciliation.md` | Investigating a stuck payment, forcing a lookup, manual settlement, refund process, provider contacts |
| `release.md` | The §9 checklist |
| `rollback.md` | Application rollback, migration rollback, feature-flag disable |
| `scale-up.md` | What to do under unexpected load: cache TTLs, disable expensive features, scale compute |
| `onboarding.md` | New developer setup, access grants, required reading |
| `offboarding.md` | Revoke access, rotate secrets, transfer ownership |
| `data-request.md` | Handling a customer data-export or deletion request |
| `migration-legacy.md` | The WordPress migration procedure (`06 §13.2`) |

---

## 11. Access control

| Resource | Who | Method |
|---|---|---|
| GitHub repository | Developers | 2FA required; branch protection on `main` and `develop` |
| Production secrets | Owner + lead developer only | Host secret manager |
| Production database | Lead developer only, and only via a bastion or the provider console | Audited |
| Hosting console | Owner + lead developer | 2FA |
| Cloudflare | Owner + lead developer | 2FA |
| Payment provider dashboards | Owner only | 2FA |
| Analytics | Owner + marketing | Read-only for marketing |
| Admin panel | Per role (`09 §12`) | 2FA for OWNER and MANAGER |

**Quarterly access review**, recorded. On any departure: revoke within one hour, rotate every shared secret the same day.

---

## 12. Cost monitoring

Monthly review of hosting, database, storage, bandwidth, email and third-party spend against the model in `03 §10`. Budget alerts at 80% and 100% of the expected monthly figure. Unexplained cost growth is investigated as an incident — it usually indicates a runaway job, a cache miss storm, or scraping.
