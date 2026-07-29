// The validation/parsing core behind `@/env`, deliberately split into its
// own file with NO `import "server-only"` guard.
//
// Why this file exists: `@/env` (src/env.ts) carries `import "server-only"`
// so that accidentally importing it into a Client Component bundle fails
// loudly at build time. That guard works correctly under Next.js's webpack
// compiler, which sets the bundler condition `server-only` relies on. It
// does NOT work under plain Node/tsx — which is exactly how `pnpm db:seed`
// runs (`tsx prisma/seed/index.ts`, see package.json). Outside Next's
// compiler, `server-only`'s package resolves to a variant that throws
// unconditionally, so any one-shot script that transitively imports
// `@/env` crashes immediately with "This module cannot be imported from a
// Client Component module" even though a seed script obviously isn't one.
//
// The fix is this file: the exact same schema and parsing logic as
// `src/env.ts`, minus the guard, so a script-only entry point
// (`src/server/db/seed-client.ts`) can read validated config without ever
// touching the `server-only` package. `src/env.ts` still re-exports this
// file's `env` behind its own `import "server-only"`, so every normal
// Next.js app import of `@/env` is exactly as protected as before — this
// file is not a general-purpose replacement for `@/env`, only the shared
// core the two entry points both build on.
//
// `no-restricted-properties` (eslint.config.mjs) still bans reading
// `process.env` anywhere except this file and `src/env.ts` themselves —
// this file is explicitly allow-listed there for the same reason `env.ts`
// already was.
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "preview", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  MAIL_FROM_TRANSACTIONAL: z.string().email().optional(),
  MAIL_REPLY_TO: z.string().email().optional(),

  ESEWA_PRODUCT_CODE: z.string().optional(),
  ESEWA_SECRET: z.string().optional(),
  ESEWA_BASE_URL: z.string().url().optional(),
  KHALTI_SECRET_KEY: z.string().optional(),
  KHALTI_BASE_URL: z.string().url().optional(),
  FONEPAY_MERCHANT_CODE: z.string().optional(),
  FONEPAY_SECRET: z.string().optional(),
  CONNECTIPS_MERCHANT_ID: z.string().optional(),
  CONNECTIPS_APP_ID: z.string().optional(),
  CONNECTIPS_APP_NAME: z.string().optional(),
  CONNECTIPS_PASSWORD: z.string().optional(),

  NEXT_PUBLIC_GTM_ID: z.string().optional(),
  NEXT_PUBLIC_GA4_ID: z.string().optional(),
  GA4_API_SECRET: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  META_CAPI_TOKEN: z.string().optional(),
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: z.string().optional(),
  TIKTOK_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_CLARITY_ID: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOGTAIL_TOKEN: z.string().optional(),

  MEILI_HOST: z.string().url().optional(),
  MEILI_MASTER_KEY: z.string().optional(),
  MEILI_SEARCH_KEY: z.string().optional(),

  CRON_SECRET: z.string().min(1).optional(),
  REVALIDATE_SECRET: z.string().min(1).optional(),
  ADMIN_IP_ALLOWLIST: z.string().optional(),

  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables — refusing to start. See .env.example.");
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
