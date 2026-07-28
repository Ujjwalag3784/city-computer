import "server-only";
import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/config";

/**
 * The one place `NextAuth()` is actually called. `src/app/api/auth/
 * [...nextauth]/route.ts` re-exports `handlers`; `middleware.ts` and every
 * Server Component/Action that needs the current session import `auth`
 * from here — never call `NextAuth()` a second time anywhere else, or
 * you'd get a second, independent adapter/provider instance.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
