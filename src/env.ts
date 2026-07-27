// The ONLY module permitted to read `process.env` (enforced by eslint.config.mjs).
// See docs/03-TECHNOLOGY-STACK.md §5. The app refuses to start if validation fails.
import "server-only";
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
