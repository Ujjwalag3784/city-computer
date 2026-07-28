"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from "@/components/ui/command";
import { GlobalSearch, type GlobalSearchGroup } from "@/components/admin/global-search";
import { cn } from "@/lib/utils";

/** Docs/09 §9: "Debounced 200ms, p95 < 150ms." */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * AdminTopBar — docs/05-DESIGN-SYSTEM.md §8: "256px sidebar (sheet below
 * `lg`) + 80px top bar + scroll area" (80px = `h-20`). docs/09-ADMIN-DAD-
 * MODE.md §9 "Global search": "A single search box in the top bar, also
 * reachable with `/` or `Ctrl/⌘ K`." Only the `Ctrl/⌘+K` shortcut is wired
 * here — the bare `/` shortcut is a documented future enhancement (it
 * requires knowing whether focus is already in a text field elsewhere on
 * the page, which is out of scope for this isolated component).
 *
 * Live search: when a caller passes `onSearch` (`(admin)/layout.tsx` passes
 * `globalAdminSearchAction` down through `AdminShell`, per that action's
 * own header comment on the `components/` <-> `app/`/`server/` boundary),
 * this debounces the `CommandInput` value by `SEARCH_DEBOUNCE_MS` and
 * renders real grouped results via `<GlobalSearch>`. `shouldFilter={false}`
 * is passed to `CommandDialog` because the results are already
 * server-ranked per keystroke — a second client-side fuzzy pass on top
 * would just hide server hits that don't happen to fuzzy-match `cmdk`'s
 * own scorer (see `ui/command.tsx`'s `shouldFilter` doc comment). When
 * `onSearch` is omitted, this falls back to the original static
 * `CommandEmpty` placeholder — no caller is broken by the new prop being
 * optional.
 *
 * Must be a Client Component: it owns the ⌘K dialog's open state, the
 * in-flight query/results state, and attaches a global `keydown` listener
 * to `window`.
 *
 * Accessibility: the mobile hamburger and the "Back to site" affordance are
 * both real controls with visible or `aria-label`led text; the hamburger is
 * icon-only so it gets an explicit `aria-label` plus the admin 48×48 hit
 * target (`Button` `size="lg" iconOnly`) per docs/09 §11 ("Touch targets
 * 48×48 CSS px minimum") rather than the general 44×44 in docs/05 §5 A9.
 * There is no real Auth.js session wiring yet, so the user menu's "Profile" /
 * "Help" / "Sign out" items are inert placeholders — wiring real auth and a
 * real sign-out action happens in a later phase (see docs/09 §14 RBAC / a
 * future Auth.js task).
 */

export interface AdminTopBarProps {
  onMobileMenuClick?: () => void;
  userName?: string;
  /** See the header comment above for why this is optional and what it wires up. */
  onSearch?: (query: string) => Promise<GlobalSearchGroup[]>;
}

export function AdminTopBar({ onMobileMenuClick, userName = "Owner", onSearch }: AdminTopBarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  // Guards against an older, slower request overwriting a newer one's
  // results if responses arrive out of order.
  const latestRequestId = useRef(0);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!onSearch) return;
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setGroups([]);
      return;
    }
    const requestId = ++latestRequestId.current;
    const timer = setTimeout(() => {
      onSearch(trimmed)
        .then((result) => {
          if (requestId === latestRequestId.current) setGroups(result);
        })
        .catch(() => {
          if (requestId === latestRequestId.current) setGroups([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleOpenChange = useCallback((open: boolean) => {
    setSearchOpen(open);
    if (!open) {
      // Fresh box every time it's reopened, per docs/09 §9's example — it
      // never shows a stale previous search.
      setQuery("");
      setGroups([]);
    }
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setQuery("");
      setGroups([]);
      router.push(href);
    },
    [router],
  );

  const initial = userName.charAt(0).toUpperCase() || "?";

  return (
    <header
      className={cn(
        "flex h-20 items-center justify-between gap-4 border-b border-glass-stroke bg-surface-container px-4 lg:px-6",
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="lg"
          iconOnly
          aria-label="Open navigation"
          className="lg:hidden"
          onClick={onMobileMenuClick}
        >
          <Menu />
        </Button>

        <button
          type="button"
          onClick={openSearch}
          className={cn(
            "hidden w-72 items-center gap-2 rounded border border-glass-stroke bg-surface-container-high px-3 text-body-sm text-on-surface-variant transition-colors sm:flex",
            "min-h-12 hover:border-primary-container hover:text-on-surface",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
          )}
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Search...</span>
          <span className="text-label-mono-xs">⌘K</span>
        </button>
      </div>

      <CommandDialog open={searchOpen} onOpenChange={handleOpenChange} shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search orders, products, customers..."
        />
        <CommandList>
          {onSearch ? (
            <GlobalSearch
              groups={groups}
              onSelect={handleSelect}
              emptyMessage={
                query.trim().length === 0
                  ? "Type to search orders, products, and customers."
                  : "No results found."
              }
            />
          ) : (
            <CommandEmpty>Type to search orders, products, and customers.</CommandEmpty>
          )}
        </CommandList>
      </CommandDialog>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft />
            Back to site
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex min-h-12 items-center gap-2 rounded px-2 text-body-sm text-on-surface transition-colors hover:bg-surface-container-high",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
              )}
            >
              <Avatar className="size-8">
                <AvatarFallback>{initial}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline">{userName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* No real Auth.js session wiring yet — these are inert placeholders until a later phase. */}
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Help</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
