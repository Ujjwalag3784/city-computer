/**
 * Auth.js module augmentation — docs/04-REPOSITORY-STRUCTURE.md places this
 * at `types/next-auth.d.ts`. Extends the library's own `Session`/`User`
 * shapes with the claims `server/auth/callbacks.ts`'s `session` callback
 * actually attaches, so every caller of `auth()` gets them typed without a
 * cast.
 *
 * Everything added here is computed once per session check in the
 * `session` callback (see `callbacks.ts`) from the database and from
 * `server/auth/session-state.ts`'s Redis-backed per-session flags — never
 * trust a client to have sent any of this.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Role keys the user currently holds, e.g. `["OWNER"]` or `["CUSTOMER"]` — see prisma/seed/core.ts's `ROLES`. */
      roleKeys: string[];
      /** The flattened `resource:action` permission set granted by every role in `roleKeys`. The only thing `requirePermission` ever checks. */
      permissionKeys: string[];
      /** True if this account has completed TOTP enrollment (docs/13 §2). Independent of whether *this session* has satisfied it — see `twoFactorVerified`. */
      twoFactorEnabled: boolean;
      /** True if this specific session has passed 2FA verification (or 2FA isn't required for this account's roles). `middleware.ts` gates `/admin` on this being true for OWNER/MANAGER. */
      twoFactorVerified: boolean;
    } & DefaultSession["user"];
    /** The raw database session token — needed by `server/auth/session-state.ts` to key its Redis-backed absolute/idle timers and the 2FA-verified flag. Never sent anywhere except as this same opaque `__Secure-` cookie value already is. */
    sessionToken: string;
  }

  interface User {
    /** Present only for accounts with 2FA enrolled — never included in anything sent to the client. */
    twoFactorSecret?: string | null;
  }
}
