/**
 * Registration — docs/07-API-DESIGN.md §4.1's flow: "register →
 * verification email → verify → login." The `UserStatus` enum
 * (`prisma/schema/schema.prisma`) has no "pending verification" state, only
 * `ACTIVE`/`SUSPENDED`/`DELETED` — so a new account is `ACTIVE` (able to
 * log in) immediately, with `emailVerified`/`phoneVerified` tracked as
 * separate nullable timestamps rather than gating login on them. JUDGMENT
 * CALL: the doc doesn't say whether login is blocked pre-verification, and
 * the schema's own enum shape only supports the "verify informationally,
 * don't gate login on it" interpretation without a migration.
 *
 * Email/SMS delivery is NOT wired up — `server/mail/` (docs/04's tree)
 * doesn't exist in this codebase yet. `registerUser` generates and stores
 * a hashed verification token exactly as the real flow will need, and
 * returns the raw token/URL-ready value to its caller so the flow is
 * fully testable end-to-end once mail sending exists; today, nothing is
 * actually emailed. Flagged, not silently skipped.
 */
import "server-only";
import { db } from "@/server/db";
import { registerSchema } from "@/lib/validation/auth";
import { assertPasswordPolicy, hashPassword } from "@/lib/password";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/token";
import { rateLimit } from "@/server/rate-limit-store";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { normalizeNepalPhone } from "@/lib/nepal";
import { logger } from "@/lib/logger";

/** docs/13 §2: "Single-use token, 60-minute TTL" — the same policy as password reset, reused here for the email-verification link. */
const VERIFICATION_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface RegisterResult {
  userId: string;
  /**
   * Present only when a *new* account was created and a verification
   * email would be sent. Absent when registration silently matched an
   * existing account (see the enumeration-resistance note below) — a
   * caller must not treat "no token" as an error.
   */
  verificationToken?: string;
}

/**
 * docs/13 §2: "Registration, login and reset return identical messages...".
 * If `identifier` already belongs to an account, this does **not** create
 * a duplicate and does **not** say so — it returns the same shape
 * (`{ userId }`, no `verificationToken`) that a genuine new registration
 * would eventually resolve to from the caller's point of view ("check
 * your email/phone"), so a prospective account-enumeration attacker can't
 * distinguish "new account created" from "you already have one" from the
 * response alone. A real deployment should also email the existing
 * address a "someone tried to register with your email — was this you?"
 * notice instead of a verification link; that's part of the not-yet-built
 * mail integration noted above.
 */
export async function registerUser(input: unknown, ip: string): Promise<RegisterResult> {
  await rateLimit("auth", `ip:${ip}`);

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw validationErrorFromZodIssues(parsed.error.issues);
  }

  const { email, phone, password, name } = parsed.data;
  await assertPasswordPolicy(password);

  const normalizedPhone = phone ? normalizeNepalPhone(phone) : null;

  const existing = await db.user.findFirst({
    where: {
      OR: [...(email ? [{ email }] : []), ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])],
    },
  });

  if (existing) {
    logger.info(
      { userId: existing.id },
      "registerUser: registration attempted for an existing account — no duplicate created, no distinguishing response",
    );
    return { userId: existing.id };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email: email ?? null,
      phone: normalizedPhone,
      passwordHash,
      name,
      status: "ACTIVE",
    },
  });

  await db.customer.create({
    data: {
      userId: user.id,
      email: email ?? null,
      phone: normalizedPhone,
      name,
    },
  });

  const customerRole = await db.role.findUnique({ where: { key: "CUSTOMER" } });
  if (customerRole) {
    await db.userRole.create({ data: { userId: user.id, roleId: customerRole.id } });
  } else {
    // Not fatal — the account still works, just with zero roles (treated
    // identically to CUSTOMER by every admin-role check) until the seed
    // is run. Loud enough to notice in logs without failing registration.
    logger.error(
      "registerUser: no seeded CUSTOMER role found — run prisma/seed before accepting registrations",
    );
  }

  let verificationToken: string | undefined;
  if (email) {
    const rawToken = generateOpaqueToken();
    await db.verificationToken.create({
      data: {
        identifier: email,
        token: hashOpaqueToken(rawToken),
        expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });
    verificationToken = rawToken;
  }

  return { userId: user.id, verificationToken };
}
