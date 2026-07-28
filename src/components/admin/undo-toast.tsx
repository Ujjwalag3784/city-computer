import { toast } from "sonner";

/**
 * showUndoToast — docs/09-ADMIN-DAD-MODE.md §7 "Order management" -> "Order
 * detail": "**Undo:** after any status change, a toast appears for 10
 * seconds — 'Marked as packed. **Undo**'. After that, the change is
 * permanent but reversible by an OWNER with a recorded reason." The
 * "permanent but reversible with a recorded reason" half of that sentence
 * is also why §6 "Stock management" insists "**Every change writes a
 * `StockMovement`.** There is no way to change stock without a recorded
 * reason." — the 10-second window this function opens is the cheap,
 * reason-free undo; anything after it must go through that recorded-reason
 * path instead, which is out of scope for this helper.
 *
 * This is a plain function, not a component. The toast *container* is
 * already `src/components/ui/sonner.tsx`'s `Toaster` (mounted once near
 * the app root, pre-styled to Obsidian Peak); individual toasts are still
 * triggered by calling `sonner`'s own `toast()` directly, from anywhere —
 * including outside React render (e.g. a mutation's `onSuccess` callback)
 * — which a component couldn't do. This wraps that call so every
 * status-change call site in the admin gets the identical "message + Undo
 * action, ~10s duration" shape instead of hand-rolling `toast()` each time.
 *
 * Verified against the installed `sonner` package's type declarations
 * (sonner@2.0.7, `dist/index.d.ts`): `toast(message, data)` takes an
 * `ExternalToast` whose `action` is `Action | React.ReactNode`, where
 * `Action = { label: React.ReactNode; onClick: (event:
 * React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
 * actionButtonStyle?: React.CSSProperties }`. A real click event is passed
 * to `onClick` at runtime; the handler below ignores it, since
 * `options.onUndo` takes none — assigning a zero-parameter function where
 * a one-parameter one is expected is valid TypeScript (parameters may be
 * dropped, not added).
 */
export function showUndoToast(options: {
  message: string;
  onUndo: () => void | Promise<void>;
  durationMs?: number;
}): void {
  toast(options.message, {
    duration: options.durationMs ?? 10_000,
    action: {
      label: "Undo",
      onClick: () => {
        void options.onUndo();
      },
    },
  });
}
