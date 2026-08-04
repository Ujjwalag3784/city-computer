/**
 * Argument parsing and role resolution for `pnpm db:create-admin`
 * (`prisma/seed/create-admin.ts`) — the script that creates the first
 * staff login, because `prisma/seed/*.ts` seeds roles and permissions but
 * deliberately creates zero `User` rows, leaving `/admin` unreachable on a
 * freshly-migrated database.
 *
 * Kept here, in `lib/`, rather than inline in the script for one reason:
 * this is the only part of that script with branching logic worth unit
 * testing (flag forms, missing/blank values, role normalisation), and
 * `vitest.config.ts` only collects `src/**` + the script itself needs a
 * live database to test anything else.
 *
 * COMMAND-LINE FLAGS, NOT ENVIRONMENT VARIABLES — a deliberate choice.
 * `eslint.config.mjs`'s `no-restricted-properties` rule bans reading
 * `process.env` anywhere except `src/env.ts` and `src/env-core.ts`, and
 * this script's inputs (one operator, one run, never read by the app) have
 * no business being in the app's validated env schema just to satisfy
 * that. `process.argv` is unrestricted and, for a runbook aimed at a
 * non-developer, a single copy-pasteable line is easier to get right than
 * exporting four shell variables first.
 */
import { z } from "zod";
import { ADMIN_ROLE_KEYS, type AdminRoleKey } from "@/lib/admin-roles";

/** The default role when `--role` is omitted. See DEPLOY_VERCEL.md for why OWNER, not STAFF: STAFF's seeded grants (prisma/seed/core.ts's `ROLE_GRANTS`) can't see products, reports, coupons, settings, content or the builder admin, which makes for a poor demo of an admin console. */
export const DEFAULT_ADMIN_ROLE_KEY: AdminRoleKey = "OWNER";

export interface CreateAdminArgs {
  email: string;
  password: string;
  name: string;
  roleKey: AdminRoleKey;
}

/** Thrown for anything the operator can fix by re-running with different flags. The script prints `.message` followed by `CREATE_ADMIN_USAGE` and exits non-zero — never a stack trace, which is noise to the audience this script is for. */
export class CreateAdminArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateAdminArgsError";
  }
}

export const CREATE_ADMIN_USAGE = `
Usage:
  pnpm db:create-admin --email=<email> --password=<password> [--name="<full name>"] [--role=<ROLE>]

Required:
  --email      The email address you will type on the sign-in page.
  --password   At least 10 characters. Checked against the breached-password
               corpus, exactly like a customer signup would be.

Optional:
  --name       Display name shown in the admin top bar. Defaults to "Owner".
  --role       One of: ${ADMIN_ROLE_KEYS.join(", ")}. Defaults to ${DEFAULT_ADMIN_ROLE_KEY}.

Example:
  pnpm db:create-admin --email=dad@citycomputer.com.np --password='choose-a-long-one' --name="Shop Owner"

Notes:
  - Re-running with the same --email updates that account (password, name,
    role) instead of failing or creating a duplicate.
  - Run \`pnpm db:seed\` first: the roles this attaches to are created there.
  - Your password appears in your shell history. Clear it afterwards if the
    machine is shared.
`.trimStart();

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Accepts both `--flag=value` and `--flag value`. Unknown flags are a hard
 * error rather than being ignored: a typo like `--emai=...` silently
 * falling through to "email is required" would send the operator hunting
 * in the wrong direction.
 */
function collectFlags(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection
    const argument = argv[index];
    if (argument === undefined) continue;

    if (!argument.startsWith("--")) {
      throw new CreateAdminArgsError(
        `Unexpected argument "${argument}" — every value needs a --flag.`,
      );
    }

    const body = argument.slice(2);
    const equalsAt = body.indexOf("=");

    if (equalsAt >= 0) {
      flags.set(body.slice(0, equalsAt), body.slice(equalsAt + 1));
      continue;
    }

    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new CreateAdminArgsError(`--${body} needs a value, e.g. --${body}=something.`);
    }
    flags.set(body, next);
    index += 1;
  }

  return flags;
}

const KNOWN_FLAGS = new Set(["email", "password", "name", "role"]);

/**
 * Turns `process.argv.slice(2)` into a validated `CreateAdminArgs`.
 * Throws `CreateAdminArgsError` — never a Zod error or a TypeError — for
 * every operator-fixable problem, so the caller has exactly one thing to
 * catch and print.
 */
export function parseCreateAdminArgs(argv: readonly string[]): CreateAdminArgs {
  const flags = collectFlags(argv);

  for (const name of flags.keys()) {
    if (!KNOWN_FLAGS.has(name)) {
      throw new CreateAdminArgsError(
        `Unknown flag --${name}. Expected one of: ${[...KNOWN_FLAGS].map((flag) => `--${flag}`).join(", ")}.`,
      );
    }
  }

  const rawEmail = flags.get("email")?.trim();
  if (!rawEmail) {
    throw new CreateAdminArgsError("--email is required.");
  }
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) {
    throw new CreateAdminArgsError(`"${rawEmail}" is not a valid email address.`);
  }

  // Not `.trim()`ed: a password's leading/trailing spaces are part of the
  // password. Only its emptiness is this function's business — the length
  // and breach-corpus policy belong to `lib/password.ts`'s
  // `assertPasswordPolicy`, which the script calls next.
  const password = flags.get("password");
  if (password === undefined || password.length === 0) {
    throw new CreateAdminArgsError("--password is required.");
  }

  const name = flags.get("name")?.trim() || "Owner";

  const rawRole = flags.get("role")?.trim();
  const roleKey = resolveAdminRoleKey(rawRole);

  return { email: parsedEmail.data, password, name, roleKey };
}

/**
 * Case-insensitive, hyphen-tolerant role lookup (`content-editor`,
 * `content_editor` and `CONTENT_EDITOR` all resolve). Rejects `CUSTOMER`
 * with a specific message rather than a generic "unknown role": it *is* a
 * real seeded role, just not one this script has any reason to grant, and
 * saying so is more useful than pretending it doesn't exist.
 */
export function resolveAdminRoleKey(raw: string | undefined): AdminRoleKey {
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_ADMIN_ROLE_KEY;
  }

  const normalized = raw.trim().toUpperCase().replace(/-/g, "_");

  if (normalized === "CUSTOMER") {
    throw new CreateAdminArgsError(
      "CUSTOMER is a storefront role with no admin access — this script only creates staff accounts. Pick one of: " +
        `${ADMIN_ROLE_KEYS.join(", ")}.`,
    );
  }

  const match = ADMIN_ROLE_KEYS.find((key) => key === normalized);
  if (!match) {
    throw new CreateAdminArgsError(
      `"${raw}" is not a staff role. Pick one of: ${ADMIN_ROLE_KEYS.join(", ")}.`,
    );
  }

  return match;
}
