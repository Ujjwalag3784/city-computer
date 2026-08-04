/**
 * Creates (or updates) one staff login — run via `pnpm db:create-admin`
 * (package.json: `tsx prisma/seed/create-admin.ts`), the same shape as
 * `pnpm db:seed`.
 *
 * WHY THIS EXISTS: `prisma/seed/*.ts` seeds settings, branches, roles,
 * permissions, role-permission grants, taxonomy, catalogue, builder parts
 * and content — but deliberately creates zero `User` rows. On a
 * freshly-migrated, freshly-seeded database there is therefore no account
 * that can sign in, and `/admin` is unreachable by anybody. This script is
 * the missing step. It is kept out of `prisma/seed/index.ts` on purpose:
 * `db:seed` must stay safe to re-run in CI and on any environment, and
 * baking a known password into it would be exactly the kind of default
 * credential docs/13-SECURITY.md exists to prevent.
 *
 * Imports `db` from `@/server/db/seed-client`, not `@/server/db`, and
 * `@/lib/admin-roles`, not `@/server/auth/permissions` — everything under
 * `server/**` (except the seed client) carries `import "server-only"`,
 * which throws unconditionally when resolved outside Next's bundler, i.e.
 * under plain `tsx`. See `src/env-core.ts`'s header for the full story.
 *
 * Deliberately NOT set here:
 *   - `twoFactorSecret`. An OWNER/MANAGER account must enroll TOTP itself
 *     at `/admin/verify-2fa` (a phone scanning a QR code); a secret this
 *     script invented would have to be printed to a terminal to be usable,
 *     which is strictly worse than the real enrollment flow.
 *   - `phone`. Nothing in the credentials sign-in path needs it, and a
 *     placeholder would occupy the `@unique` phone slot a real customer
 *     account might later want.
 */
import { db } from "@/server/db/seed-client";
import { assertPasswordPolicy, hashPassword } from "@/lib/password";
import { requiresTwoFactor } from "@/lib/admin-roles";
import {
  CREATE_ADMIN_USAGE,
  CreateAdminArgsError,
  parseCreateAdminArgs,
} from "@/lib/admin-bootstrap";
import { ValidationError } from "@/lib/errors";

async function main() {
  const args = parseCreateAdminArgs(process.argv.slice(2));

  // The same policy a customer signup enforces (docs/13 §2: >= 10 chars,
  // checked against the breached-password corpus). Not skipped for
  // convenience: the most powerful account in the system is the last one
  // that should get a weaker password rule than everyone else. The
  // breach check fails open if api.pwnedpasswords.com is unreachable —
  // see `lib/password.ts`.
  await assertPasswordPolicy(args.password);

  const role = await db.role.findUnique({ where: { key: args.roleKey } });
  if (!role) {
    throw new Error(
      `Role "${args.roleKey}" does not exist in this database yet.\n` +
        `Roles are created by the main seed — run \`pnpm db:seed\` first, then re-run this command.`,
    );
  }

  const passwordHash = await hashPassword(args.password);

  // `emailVerified` is set to now on create. Worth being precise about
  // why, because it is NOT a login requirement: the Credentials provider's
  // `authorize()` (src/server/auth/config.ts) checks `passwordHash`,
  // `status === "ACTIVE"` and `lockedUntil` — it never looks at
  // `emailVerified`, so a null value would still sign in fine today. It is
  // set because it is *true*: an operator running this command on their own
  // database is asserting ownership of that address far more strongly than
  // clicking a mailed link would, and there is no mail provider configured
  // to send that link anyway (see PROGRESS.md Phase 7: "No email either").
  // Leaving it null would also silently misreport this account in the
  // admin's own staff list. On re-run it is left alone rather than pushed
  // forward, so a genuine earlier verification timestamp is never rewritten.
  const user = await db.user.upsert({
    where: { email: args.email },
    create: {
      email: args.email,
      name: args.name,
      passwordHash,
      status: "ACTIVE",
      emailVerified: new Date(),
    },
    update: {
      name: args.name,
      passwordHash,
      // Re-running is the documented way to recover a forgotten password,
      // so an account that had been suspended or locked out by failed
      // attempts is deliberately reset to a usable state here.
      status: "ACTIVE",
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  // Additive, and idempotent against the `@@unique([userId, roleId])` on
  // `user_roles`. Existing roles are intentionally left in place: this
  // script's job is "make sure this account holds this role," not "make
  // this the only role it holds" — revoking a role is an admin-console
  // action (/admin/users) with an audit trail, not something a bootstrap
  // script should do silently.
  await db.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id },
    update: {},
  });

  const allRoles = await db.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });
  const roleKeys = allRoles.map((entry) => entry.role.key).sort();

  // Never prints the password back, by design.
  console.log("");
  console.log("Staff account ready.");
  console.log(`  Email:        ${user.email}`);
  console.log(`  Name:         ${user.name}`);
  console.log(`  Role granted: ${role.key} (${role.name})`);
  console.log(`  All roles:    ${roleKeys.join(", ")}`);
  console.log(`  Status:       ${user.status}`);
  console.log(`  Sign in at:   /auth/login`);
  console.log("");

  if (requiresTwoFactor(roleKeys)) {
    console.log(
      `  ${role.key} requires two-factor authentication (docs/13 §2). After signing in\n` +
        `  you will be sent to /admin/verify-2fa to scan a QR code with an\n` +
        `  authenticator app (Google Authenticator, Authy, 1Password, ...). This\n` +
        `  step needs a reachable REDIS_URL — see DEPLOY_VERCEL.md.`,
    );
  } else {
    console.log(
      `  ${role.key} does not require two-factor authentication, so /admin is\n` +
        `  reachable straight after signing in. Note that ${role.key}'s permissions\n` +
        `  are narrower than OWNER's — see DEPLOY_VERCEL.md for exactly which\n` +
        `  admin screens each role can open.`,
    );
  }
  console.log("");
}

main()
  .catch((error) => {
    if (error instanceof CreateAdminArgsError) {
      console.error(`\n${error.message}\n`);
      console.error(CREATE_ADMIN_USAGE);
      process.exitCode = 1;
      return;
    }
    if (error instanceof ValidationError) {
      // `assertPasswordPolicy`'s failures (too short, found in a breach
      // corpus) — the operator needs the plain-language reason, not a
      // stack trace.
      console.error("\nThat password can't be used:");
      for (const issue of error.issues ?? []) {
        console.error(`  - ${issue.message}`);
      }
      console.error("");
      process.exitCode = 1;
      return;
    }
    console.error("Creating the staff account failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
