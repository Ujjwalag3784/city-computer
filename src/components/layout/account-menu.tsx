"use client";

/**
 * AccountMenu — what the header's Account icon opens into. Before this
 * existed, that icon had no `onClick`/`href` at all (remediation audit,
 * `docs/AUDIT.md` §1a: "a fully inert control"). Built on the existing
 * Radix-backed `DropdownMenu` primitive (already used by
 * `admin-topbar.tsx`'s own user menu), which gets keyboard navigation,
 * closing on outside click, and closing on Escape for free — no custom
 * event-listener plumbing needed for any of that.
 *
 * `"use client"`: owns the menu's open/closed state via Radix, and the
 * signed-in sign-out item calls a Server Action directly from a click
 * handler (a plain async RPC call, not a form submission — no page
 * reload needed for something this small).
 */
import { LogOut, Package, User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { signOutAction } from "@/app/[locale]/(auth)/auth/login/_actions";

export interface AccountMenuUser {
  name: string | null;
  email: string | null;
}

export interface AccountMenuProps {
  /** `null` when signed out — the only thing that changes which items render. */
  user: AccountMenuUser | null;
}

export function AccountMenu({ user }: AccountMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="md" iconOnly aria-label="Account">
          <User />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user ? (
          <>
            <DropdownMenuLabel className="max-w-52 truncate font-normal text-on-surface-variant">
              {user.name ?? user.email ?? "Your account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account" className="flex items-center gap-2">
                <Package className="size-4" />
                Your orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                void signOutAction();
              }}
              className="flex items-center gap-2"
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/auth/login?callbackUrl=/account" className="flex items-center gap-2">
                <User className="size-4" />
                Sign in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/auth/register" className="flex items-center gap-2">
                <UserPlus className="size-4" />
                Create account
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
