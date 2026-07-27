/**
 * Liveness + dependency health check. See docs/07-API-DESIGN.md §7 and
 * docs/15-DEVOPS-CICD.md §8. Never cached; never exposes version/config.
 *
 * Phase 1: reports basic liveness only. Database/Redis/storage checks are
 * added in Phase 3+ once those services exist.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
