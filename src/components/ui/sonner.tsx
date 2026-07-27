import * as React from "react";
import { Toaster as Sonner } from "sonner";

/**
 * Toaster — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Toast /
 * Sonner". The project uses the already-installed `sonner`
 * package directly rather than building a Toast primitive from scratch;
 * this is a thin wrapper that pre-configures its palette to Obsidian Peak.
 * Dark-only per docs/05 §1 (no light theme ships in v1). `sonner` manages
 * its own `aria-live="polite"` region internally (docs/05 §5 A7) and keeps
 * its status icons by default (docs/05 §1.5: status is never colour alone),
 * so neither is reimplemented here.
 */
export const Toaster = ({ ...props }: React.ComponentProps<typeof Sonner>) => (
  <Sonner
    theme="dark"
    className="toaster group"
    toastOptions={{
      classNames: {
        toast:
          "group toast rounded-xl border border-glass-stroke bg-surface-container-high text-on-surface shadow-glow",
        title: "text-on-surface text-body-sm font-medium",
        description: "text-on-surface-variant text-body-sm",
        actionButton: "bg-primary text-on-primary rounded",
        cancelButton: "bg-surface-container text-on-surface-variant rounded",
        error: "border-error text-on-error-container",
        success: "border-success",
        warning: "border-warning",
        info: "border-primary-container",
      },
    }}
    {...props}
  />
);
