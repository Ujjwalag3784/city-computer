import { handlers } from "@/server/auth";

// docs/04-REPOSITORY-STRUCTURE.md's `app/api/auth/[...nextauth]/route.ts` —
// Auth.js's own sign-in/callback/session/CSRF endpoints under `/api/auth/*`.
export const { GET, POST } = handlers;
