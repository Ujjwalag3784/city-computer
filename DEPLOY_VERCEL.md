# Putting City Computer Systems online (Vercel) — a first-time guide

This is written for someone who is **not a developer**. Follow it top to
bottom. Every command is meant to be copied and pasted exactly. Where you
have to invent a value (a password, a project name), it says so.

Total time: about 45 minutes, most of it waiting for things to finish.
Everything used here is free.

**Read this first — what you are and are not getting.** This is a *demo*
deployment. The shop front, the product pages, the PC builder, the cart,
checkout with Cash on Delivery and Bank Transfer, and the whole admin
console are real and work against a real database. What is **not** built at
all, and will not work no matter how carefully you follow this guide:

- **Online payments.** eSewa, Khalti, Fonepay and connectIPS were never
  integrated — not "configured wrong," not built. Only Cash on Delivery and
  Bank Transfer exist.
- **Any email or SMS.** Nobody receives an order confirmation, a password
  reset link, or a verification code. There is no mail or SMS provider
  wired in.
- **Photo uploads**, unless you also set up file storage (step 3's optional
  list). Without it, the admin's photo library and the bank-transfer receipt
  upload will tell you storage isn't configured instead of working.
- **The search box** and the "did you mean the product you already added?"
  duplicate warning, until you run step 5.3. They fail quietly (empty
  results) rather than erroring.

Also, honestly: **`pnpm build` has never been run to completion by anyone.**
The type checker, the linter and all 738 automated tests pass, the route
tree loads, and pages render — but no one has yet watched a full production
build finish. Vercel running it in step 4 will be the first time. If it
fails, the error will be on Vercel's build log page and the troubleshooting
section at the end covers the likely causes.

---

## Step 1 — Create the database (free, ~5 minutes)

Use **Neon**. It is the easiest to pair with Vercel, its free tier is
generous, and it gives you the *pooled* connection string this app needs
without extra work.

1. Go to <https://neon.com> and click **Sign up**. Sign in with GitHub — it
   saves a step later.
2. It will offer to create your first project. Name it `citycomputer`.
   - **Postgres version**: leave the default.
   - **Region**: pick the one closest to Nepal — usually
     *Asia Pacific (Singapore)* or *AWS ap-southeast-1*.
3. Click **Create project**. It takes a few seconds.
4. You land on a page showing a **Connection string** box. There is a
   toggle or checkbox near it labelled **Pooled connection** (sometimes
   shown as *Connection pooling*). **Turn it on.**
5. Click the copy button. You now have something like:

   ```
   postgresql://citycomputer_owner:AbC123xyz@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   The important part is `-pooler` in the middle. If your string does not
   contain `-pooler`, go back and turn pooling on.

6. **Paste it into a plain text file on your computer for now.** You will
   need it three separate times. Call it `DATABASE_URL`.

> **Why pooled matters.** Vercel runs the site as many small short-lived
> processes. Each one opens its own database connection. A normal Postgres
> connection string runs out of connections quickly under that pattern; the
> pooled one is designed for it. This app talks to Postgres through Prisma's
> `PrismaPg` driver adapter (`src/server/db/create-client.ts`), which uses
> whatever `DATABASE_URL` you give it directly — so this is the one place to
> get it right.

Supabase also works and also offers a pooled string (theirs says
`pgbouncer` / port `6543`). Neon is recommended only because the click path
is shorter.

---

## Step 2 — Create the Redis (free, ~3 minutes) — **yes, you need this**

**The admin console will not work without a Redis.** This is not a
precaution, it is how the app is built, and it was verified by reading and
running the code:

- Staff sessions have two separate clocks — an 8-hour hard limit and a
  30-minute inactivity limit — and a "has this person passed the two-factor
  step" flag. There are no database columns for any of the three; they live
  in Redis (`src/server/auth/session-state.ts`, which explains why).
- `src/middleware.ts` checks those Redis values on **every single
  `/admin` request**, and it is written to fail *closed*: if it cannot
  confirm the session is inside both windows, you do not get in. With no
  Redis, there is nothing to confirm.
- The two-factor step for an Owner account writes its "verified" flag to
  Redis too. No Redis, no way to finish signing in.

The shop front is different: **the storefront works fine without Redis.**
Only the rate limiting degrades (it deliberately gives up and allows the
request rather than blocking it). Verified by running the site with Redis
switched off: the sign-in page returned a normal 200 and the only symptom
was a repeating "Redis client error" line in the log.

So: 3 minutes now, or a demo where `/admin` never opens.

1. Go to <https://upstash.com> and click **Sign up** (GitHub sign-in again).
2. Click **Create Database** (under Redis, not Kafka/Vector).
   - **Name**: `citycomputer`
   - **Type / Primary Region**: the region closest to Nepal, and the same
     rough area you picked for Neon.
   - Leave everything else at its default. The free tier is fine.
3. Open the database, find the **Connect** / **Redis Connect** panel, and
   look for the **`redis://` or `rediss://` URL** — not the REST URL, not
   the token on its own. It looks like:

   ```
   rediss://default:AbCdEf123456@apn1-cool-name-12345.upstash.io:6379
   ```

   (Two `s`es in `rediss://` is correct — it means encrypted.)
4. Paste it into your text file as `REDIS_URL`.

---

## Step 3 — Work out your environment variables

An "environment variable" is a setting you give Vercel instead of writing it
into the code. There are only two the app absolutely insists on, and a few
more you want anyway.

This list is derived from the actual validation schema in
`src/env-core.ts` — the two "required" ones are literally the only two
fields in it with no default and no `.optional()`. Everything else either
has a default or is allowed to be missing.

### 3.1 Required — the app refuses to start without these

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Your pooled Neon string from step 1. |
| `AUTH_SECRET` | A long random string. Generate it — see below. |

If either is missing, the deployment crashes immediately with
`Invalid environment variables — refusing to start.`

**To generate `AUTH_SECRET`**, open a terminal on your own computer and run
whichever of these works:

```bash
openssl rand -base64 32
```

```bash
# if you don't have openssl (works anywhere Node is installed):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the whole line it prints. It will look like
`k3Jh8f2mQp0wZ9xR7tYbN4vC6sA1dE5gH2jK8lM0nP4=`. Paste it into your text
file. **Never put this in a message, a screenshot, or the repository.**

### 3.2 Needed in practice — set these too

| Name | Value | What breaks without it |
| --- | --- | --- |
| `REDIS_URL` | Your Upstash string from step 2. | Has a default of `redis://localhost:6379`, so the app *starts* — but nothing is listening, so `/admin` never opens. This is the trap this guide exists to warn you about. |
| `NEXT_PUBLIC_SITE_URL` | Your live address, e.g. `https://citycomputer.vercel.app` — **no trailing slash**. | Defaults to `http://localhost:3000`, which would put localhost links into every page's SEO tags, the sitemap, and the social-preview images. |
| `AUTH_URL` | The same address as above. | Sign-in usually still works (it can guess from the request), but setting it removes the guesswork. |
| `APP_ENV` | `production` | Anything else makes `/robots.txt` tell Google not to index the site at all. Correct for a preview, wrong for a real demo. |

You will not know your Vercel address until step 4, so: do step 4 first with
just the four values you already have, then come back and add
`NEXT_PUBLIC_SITE_URL`, `AUTH_URL` and `APP_ENV` and redeploy. Step 4 says
when.

### 3.3 Optional — leave these out and the feature politely turns itself off

None of these stop the site working. Each one is checked before use and the
feature reports "not configured" instead of erroring.

- **File storage (photo uploads, bank receipts)** — `S3_ENDPOINT`,
  `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `NEXT_PUBLIC_CDN_URL`. Any S3-compatible service (Cloudflare R2's free
  tier is the usual pick). Without all five, `/admin/media` and the
  receipt upload say storage isn't set up.
- **Email** — `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_FROM_TRANSACTIONAL`,
  `MAIL_REPLY_TO`. Note that even *with* these, no order emails get sent —
  that code was never written (see the top of this document).
- **Payment gateways** — `ESEWA_*`, `KHALTI_*`, `FONEPAY_*`,
  `CONNECTIPS_*`. Setting these does nothing today. The integrations do not
  exist.
- **Google sign-in** — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Analytics** — `NEXT_PUBLIC_GTM_ID`, `NEXT_PUBLIC_GA4_ID`,
  `GA4_API_SECRET`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TOKEN`,
  `NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `TIKTOK_ACCESS_TOKEN`,
  `NEXT_PUBLIC_CLARITY_ID`.
- **Error tracking** — `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
  `SENTRY_AUTH_TOKEN`.
- **Search server** — `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_SEARCH_KEY`.
- **Others** — `DIRECT_DATABASE_URL`, `CRON_SECRET`,
  `REVALIDATE_SECRET`, `ADMIN_IP_ALLOWLIST`, `SMS_*`, `LOG_LEVEL`, `PORT`,
  `NODE_ENV`.

> **`ADMIN_IP_ALLOWLIST` deserves a warning.** If you set it, only the
> exact IP addresses listed can reach `/admin` — everyone else gets a "page
> not found". Leave it empty for a demo, or you will lock yourself out from
> your own phone.

---

## Step 4 — Put it on Vercel (~10 minutes, mostly waiting)

1. Go to <https://vercel.com> and **Sign up with GitHub**. Approve the
   permissions it asks for.
2. On your dashboard, click **Add New...** → **Project**.
3. You get a list of your GitHub repositories. Find **`city-computer`** and
   click **Import**. If it isn't listed, click
   *Adjust GitHub App Permissions* and grant Vercel access to it.
4. The **Configure Project** screen appears. Almost everything is already
   correct — Vercel detects Next.js and pnpm on its own.
   - **Framework Preset**: should already say *Next.js*. Leave it.
   - **Build and Output Settings**: leave every field empty/default. Do
     **not** type a build command. The repository's own
     `package.json` build script is
     `prisma generate && next build`, which is what you want — the
     `prisma generate` half is essential, because Vercel installs the
     project from scratch every time and the database client code is
     generated, not stored in the repository.
   - **Root Directory**: leave as `./`.
5. Expand **Environment Variables** and add the four values from your text
   file, one at a time (**Key** = the name, **Value** = the value):
   `DATABASE_URL`, `AUTH_SECRET`, `REDIS_URL`, and `APP_ENV` = `production`.
6. Click **Deploy** and wait. Expect **4–8 minutes** — this is a large
   project and it is the first build, so nothing is cached.
7. When it finishes you get a confetti screen and an address like
   `https://city-computer-abc123.vercel.app`. **Copy that address.**
8. Now go to **Settings → Environment Variables** and add the last two,
   using that address (no trailing slash):
   - `NEXT_PUBLIC_SITE_URL` = `https://city-computer-abc123.vercel.app`
   - `AUTH_URL` = `https://city-computer-abc123.vercel.app`
9. Go to the **Deployments** tab, click the **⋯** menu on the newest
   deployment, and choose **Redeploy**. Environment variables are baked in
   at build time, so they only take effect after a rebuild.

If the build fails, jump to **Troubleshooting** at the end. Do not continue
to step 5 until you have a green deployment.

---

## Step 5 — Fill the database (~10 minutes)

**Where this runs: on your own computer, in a terminal, pointed at the
hosted database.** You cannot run commands inside Vercel — there is no
terminal there. Your laptop connects to Neon over the internet and does the
work; Vercel is only serving the website.

Open a terminal, go to the project folder, and install the tools once:

```bash
cd path/to/CityComputer
pnpm install
```

Then tell this terminal to use the hosted database. Pick the line for your
system and **paste your own Neon string in place of the example**:

```bash
# macOS / Linux / Git Bash on Windows
export DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"
```

```powershell
# Windows PowerShell
$env:DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"
```

> Everything below affects the **live** database. There is nothing in it
> yet, so there is nothing to lose — but be careful re-running step 5.1
> later once you have real orders.

### 5.1 Create the tables

```bash
pnpm db:deploy
```

That is `prisma migrate deploy`. **This is the correct command, not
`prisma db push`** — the repository does contain a real migration
(`prisma/migrations/20260727175048_pnpm_db_seed/migration.sql`, 2,614 lines)
and it was checked to cover all 90 tables in the schema. You should see
`1 migration found` and then `applied`.

### 5.2 Add the starting data

```bash
pnpm db:seed
```

This creates the shop settings, the New Road branch and its opening hours,
the seven staff roles and all their permissions, the delivery zones and
shipping prices, the categories and brands, about a dozen demo products, the
PC-builder parts and its 37 compatibility rules, and the policy pages. It is
safe to run more than once.

It creates **no user accounts at all** — that is step 5.4, and it is why
this guide exists.

### 5.3 Add the extra database rules

```bash
pnpm prisma db execute --file prisma/sql/manual-constraints.sql --schema prisma/schema/schema.prisma
```

This adds things Prisma's schema language cannot express: safety checks
(prices must be positive, an account must have an email or a phone), the
full-text-search indexes the search box needs, and a few triggers.

**Be aware: this file has never been run against a real database by
anybody.** It is written defensively (every statement is safe to re-run) but
it is a careful draft, not a proven script. If it errors, note the message
and carry on — the site still works. What you lose is the storefront search
box returning results and the admin's duplicate-product-name warning, both
of which are built to skip themselves quietly rather than break.

### 5.4 Create your login

```bash
pnpm db:create-admin --email=you@example.com --password='pick-a-long-one' --name="Shop Owner"
```

Replace the email with a real address you will remember and the password
with something **at least 10 characters** long. Keep the single quotes
around the password.

- The password is checked against a list of passwords known to have leaked
  in real breaches, exactly as a customer signup would be. If it is
  rejected, that is why — pick something less obvious. `password123` will
  not be accepted.
- Running the command again with the same email **updates** that account
  (new password, name, role) rather than failing or creating a duplicate.
  That is how you reset a forgotten password.
- It never prints your password back. It prints the email, the name, the
  role, and where to sign in.
- Add `--role=MANAGER` (or `STAFF`, `SUPPORT`, `TECHNICIAN`,
  `CONTENT_EDITOR`) if you want a different level of access. With no
  `--role` you get **Owner**.
- Your password will be sitting in your terminal history afterwards. On a
  shared computer, clear it (`history -c` on macOS/Linux).

> **Why the default is Owner, and what it costs you.**
>
> Owner sees the entire admin console. The alternative — a `STAFF` account —
> avoids the two-factor step below entirely, but Staff's permissions
> (`prisma/seed/core.ts`) are only: view products, view and advance orders,
> update stock, view customers, and handle repair jobs. A Staff account
> **cannot** open the product wizard, reports, coupons, campaigns, settings,
> the blog, the CMS pages, staff accounts, or the PC-builder admin. Roughly
> two thirds of the admin console is invisible to it. For showing someone
> what has been built, that is a poor demo.
>
> So the default is Owner, and the price is one extra 60-second setup with
> your phone (step 6.3). `--role=STAFF` remains available if you would
> rather skip it — and `--role=MANAGER` sees nearly everything Owner does
> but still requires two-factor, so it buys you nothing here.
>
> The two-factor requirement itself was deliberately **not** weakened or
> switched off to make this easier. It is a real security control on the
> account that can change prices and approve payments.

---

## Step 6 — The demo

Replace `YOUR-SITE` with your Vercel address in each link.

### 6.1 The shop front

| What to show | Address |
| --- | --- |
| Home page | `https://YOUR-SITE/` |
| A product page | `https://YOUR-SITE/` → click any product card |
| A category page | `https://YOUR-SITE/c/laptops` |
| **The PC builder** | `https://YOUR-SITE/build/new` |
| EMI calculator | `https://YOUR-SITE/emi-calculator` |
| Repair booking | `https://YOUR-SITE/service` |
| Blog | `https://YOUR-SITE/blog` |
| Store locator | `https://YOUR-SITE/stores` |

The PC builder is the most impressive thing here. Pick *Standard* mode, then
deliberately choose parts that do not fit together — a small case with a big
graphics card — and it will explain, in plain English, exactly what is
wrong. That is a real rule engine with 37 database-driven rules behind it,
not a canned message.

You can also add things to the cart and place a Cash-on-Delivery order end
to end. It creates a real order you can then find in the admin.

### 6.2 Signing in

Go to **`https://YOUR-SITE/auth/login`**.

Type the email and password from step 5.4 and click **Sign in**.

### 6.3 The two-factor step (Owner and Manager only)

You are sent to `/admin/verify-2fa` automatically. Once, ever, per account:

1. On your phone, install an authenticator app if you do not have one —
   **Google Authenticator**, **Microsoft Authenticator**, **Authy** and
   **1Password** all work.
2. Open it, choose *add account* / the **+** button, and **scan the square
   QR code** on the screen. If the camera will not cooperate, the page also
   shows the same key as text you can type in.
3. The app now shows a 6-digit number that changes every 30 seconds. Type
   the current one into the box and click **Finish setup and continue**.

You land in the admin console. From then on, signing in asks for the
password and then just the 6-digit code — no more QR codes.

If you refresh that page before finishing, the same QR code comes back on
purpose, so a half-scanned setup is not ruined.

> **There are no backup codes yet.** If you lose the phone, you cannot get
> back in through the website. The recovery route is to run step 5.4 again
> from your computer with a `--role=STAFF` account and use that instead.
> This gap is known and tracked, not an oversight.

### 6.4 The admin console

`https://YOUR-SITE/admin`

Worth showing, roughly in order of impact:

- **Today** (`/admin`) — real counts and a "what needs you right now" list.
- **Products** (`/admin/products`) — edit a price or a stock number
  directly in the table; **+ Add product** opens the four-step wizard.
- **Inventory** (`/admin/inventory`) — the +/− stock control that always
  demands a reason, and per-product stock history.
- **Orders** (`/admin/orders`) — find the order you placed in 6.1 and move
  it forward.
- **Reports** (`/admin/reports`) — sales, best sellers, stock, search gaps.
- **Activity History** (`/admin/activity`) — every change anyone made.
- **Settings** (`/admin/settings`) — including the EMI bank terms, editable
  without a redeploy.
- **Help** (`/admin/help`) — 12 in-product help articles.

---

## Troubleshooting

These are the failures actually encountered while preparing this, not
generic advice.

### "Catch-all must be the last part of the URL" in the build log

The build fails almost immediately with this. It means your working copy
still contains the file
`src/app/[locale]/(storefront)/c/[...categorySlug]/opengraph-image.tsx`,
which **must be deleted** — Next.js refuses to load the entire route tree
while it exists, so nothing at all can be built. Its replacement already
lives at `src/app/api/og/category/route.tsx`. Delete the old file, commit,
and push:

```bash
git rm "src/app/[locale]/(storefront)/c/[...categorySlug]/opengraph-image.tsx"
git commit -m "fix: remove the opengraph-image file inside a catch-all route"
git push
```

Vercel rebuilds automatically when you push.

### "Invalid environment variables — refusing to start."

`DATABASE_URL` or `AUTH_SECRET` is missing or empty in Vercel. Check
**Settings → Environment Variables**, then **Redeploy** — adding a variable
does nothing until you rebuild. Also check you did not paste a trailing
space or a line break into the value.

### `/admin` keeps sending you back to the sign-in page

Almost always `REDIS_URL`. Either it is not set, or the value is the REST
URL from Upstash rather than the `rediss://` one. The admin gate is written
to fail closed, so an unreachable Redis is indistinguishable from an expired
session and you get bounced. The clue is in Vercel's **Runtime Logs**:
repeated `Redis client error` with `ECONNREFUSED` or a connection timeout.

The other possibility, if the site is *not* broken, is that it worked
correctly: staff sessions really do expire after 8 hours, or after 30
minutes of doing nothing. The sign-in page says so when that happens.

### "Too many connections" / the site is fine then suddenly errors

Your `DATABASE_URL` is not the pooled one. Go back to Neon, turn on
**Pooled connection**, copy the string with `-pooler` in it, replace the
Vercel variable, and redeploy.

### Sign-in says the email and password didn't work, and you are sure they did

Three real causes, in order of likelihood:

1. You have tried more than 5 times in 15 minutes and are rate-limited.
   Wait 15 minutes. The message deliberately does not distinguish this from
   a wrong password.
2. You ran `pnpm db:create-admin` while your terminal was still pointed at
   a *local* database instead of the Neon one, so the account exists on your
   laptop and not on the live site. Re-do the `export DATABASE_URL=...`
   line, then re-run step 5.4.
3. You ran step 5.4 before step 5.2. The roles come from the seed; the
   command would have told you to run `pnpm db:seed` first.

### The search box returns nothing

Step 5.3 did not run, or errored. Search needs the full-text indexes from
`manual-constraints.sql`. Browsing by category and brand works regardless.

### Photo upload says storage is not configured

Correct, and expected — see step 3.3. You need the five `S3_*` variables
pointing at an S3-compatible bucket. Everything else in the admin works
without them.
