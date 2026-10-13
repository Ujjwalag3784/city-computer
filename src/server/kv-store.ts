/**
 * Expiring key/value state in Postgres (`kv_entries`), replacing Redis.
 *
 * The live site's Redis was unreachable from Vercel, and because admin
 * sessions, the 2FA gate and rate limiting all lived there, no admin could
 * sign in ("We couldn't complete sign-in just now"). Postgres is already a
 * hard dependency of every page, so keeping this state there removes a
 * second service that can fail on its own. The volume is tiny (a few rows
 * per signed-in admin, a counter per rate-limited key), well within what a
 * single indexed table handles.
 *
 * Every read treats an expired row as absent, so correctness never depends
 * on the purge (`purgeExpiredKv`) having run.
 */
import "server-only";
import { db } from "@/server/db";

function expiresAt(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

/** SET key value EX ttl — always overwrites. */
export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const until = expiresAt(ttlSeconds);
  await db.$executeRaw`
    INSERT INTO kv_entries (key, value, expires_at) VALUES (${key}, ${value}, ${until})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
  `;
}

/**
 * SET key value EX ttl NX — writes only if the key is absent or expired.
 * Returns true when this call wrote the value.
 */
export async function kvSetIfAbsent(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const until = expiresAt(ttlSeconds);
  const written = await db.$executeRaw`
    INSERT INTO kv_entries (key, value, expires_at) VALUES (${key}, ${value}, ${until})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at
    WHERE kv_entries.expires_at <= now()
  `;
  return written === 1;
}

/** GET key — null when missing or expired. */
export async function kvGet(key: string): Promise<string | null> {
  const rows = await db.$queryRaw<{ value: string }[]>`
    SELECT value FROM kv_entries WHERE key = ${key} AND expires_at > now()
  `;
  return rows[0]?.value ?? null;
}

/** How many of `keys` exist and haven't expired. */
export async function kvCountLive(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count FROM kv_entries
    WHERE key = ANY(${keys}) AND expires_at > now()
  `;
  return Number(rows[0]?.count ?? 0n);
}

/** DEL key [key …] */
export async function kvDelete(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.$executeRaw`DELETE FROM kv_entries WHERE key = ANY(${keys})`;
}

/**
 * INCR with a TTL set on first write (a fixed-window counter). An expired
 * row restarts from 1. Returns the new count.
 */
export async function kvIncrement(key: string, ttlSeconds: number): Promise<number> {
  const until = expiresAt(ttlSeconds);
  const rows = await db.$queryRaw<{ value: string }[]>`
    INSERT INTO kv_entries (key, value, expires_at) VALUES (${key}, '1', ${until})
    ON CONFLICT (key) DO UPDATE SET
      value = CASE WHEN kv_entries.expires_at <= now() THEN '1'
                   ELSE (kv_entries.value::bigint + 1)::text END,
      expires_at = CASE WHEN kv_entries.expires_at <= now() THEN EXCLUDED.expires_at
                        ELSE kv_entries.expires_at END
    RETURNING value
  `;
  return Number(rows[0]?.value ?? 1);
}

/** Deletes expired rows. Housekeeping only — reads already ignore them. */
export async function purgeExpiredKv(): Promise<number> {
  return db.$executeRaw`DELETE FROM kv_entries WHERE expires_at <= now()`;
}
