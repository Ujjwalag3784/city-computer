"use client";

/**
 * The client-side cart cache — docs/04-REPOSITORY-STRUCTURE.md §3 names
 * this exact file (`stores/cart-store.ts`, Zustand) as Phase 6's intended
 * mechanism for "live cart state" shared between the header's cart badge
 * (a different route/component tree than wherever a mutation happens) and
 * `MiniCartDrawer`. This codebase had no `createContext`/store precedent
 * before this file — see this file's own tests for the only coverage of
 * its behaviour, since it holds no server logic to unit test elsewhere.
 *
 * NOT the source of truth: the database is. This store is a read cache
 * that every mutation refreshes from the Server Action's own returned
 * `CartView` (`_actions.ts` always returns the freshly re-resolved cart),
 * never computed or guessed at client-side — there is no local quantity
 * math, price math, or stock math anywhere in this file.
 */
import { create } from "zustand";
import type { CartView } from "@/server/services/commerce/cart";

/**
 * Re-exported so `components/**` files can type against `CartView` without
 * importing `server/**` directly — an ESLint rule
 * (`docs/04-REPOSITORY-STRUCTURE.md §3`) forbids that import from
 * anywhere under `components/`, but `stores/**` isn't covered by that
 * restriction, so this file is the one legal place a component can get
 * the type from. `import type` only — no runtime code from the
 * `"server-only"` module crosses this boundary.
 */
export type { CartView };

interface CartStoreState {
  view: CartView | null;
  isDrawerOpen: boolean;
  setView: (view: CartView) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useCartStore = create<CartStoreState>((set) => ({
  view: null,
  isDrawerOpen: false,
  setView: (view) => set({ view }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));
