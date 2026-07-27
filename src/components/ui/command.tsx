import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

/**
 * Command — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Command (⌘K
 * admin search)". `cmdk`'s own `Command` root already owns full keyboard
 * nav, roving focus, and fuzzy filtering (docs/05 §5 A5: composite widgets
 * must use a real primitive, never hand-rolled) — this file is purely a
 * token restyle of the standard shadcn `command.tsx`, the same "restyle,
 * don't rebuild" approach as `popover.tsx` / `dialog.tsx` /
 * `dropdown-menu.tsx` in this folder.
 */
export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex flex-col overflow-hidden rounded-xl bg-surface-container-high text-on-surface",
      className,
    )}
    {...props}
  />
));
Command.displayName = "Command";

export interface CommandDialogProps extends React.ComponentPropsWithoutRef<typeof Dialog> {
  /**
   * Visually-hidden accessible title/description for the dialog. Radix
   * requires a `DialogTitle` on every `DialogContent` for screen readers
   * (docs/05 §5 A1/A12) — the ⌘K palette has no visible heading, so these
   * exist purely for assistive tech via `DialogHeader`'s `sr-only` wrapper.
   */
  title?: string;
  description?: string;
}

/**
 * The actual ⌘K admin search entry point (docs/05 §6) — composes this
 * project's own `Dialog`/`DialogContent` (docs/05 §6 "Dialog") rather than
 * reaching into `@radix-ui/react-dialog` directly, per the task brief.
 */
export function CommandDialog({
  children,
  title = "Command palette",
  description = "Search for a command or admin page, then press Enter to run it.",
  ...props
}: CommandDialogProps) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-label-mono-xs [&_[cmdk-group-heading]]:text-on-surface-variant">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-glass-stroke px-3">
    <Search className="size-4 shrink-0 text-on-surface-variant" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full bg-transparent text-body-sm text-on-surface outline-none",
        "placeholder:text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-80 overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

/**
 * The palette's own empty state — a simple centred text row, not the
 * generic `EmptyState` primitive (docs/05 §6). `EmptyState` is built for
 * full page sections (illustration + explanation + primary action, docs/05
 * §7 "Empty"); this lives inside a small popover/dialog where that much
 * weight would overflow the available height.
 */
export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className="py-6 text-center text-body-sm text-on-surface-variant"
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-on-surface",
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5",
      "[&_[cmdk-group-heading]]:text-label-mono-xs [&_[cmdk-group-heading]]:text-on-surface-variant",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-outline-variant", className)}
    {...props}
  />
));
CommandSeparator.displayName = "CommandSeparator";

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5",
      "text-body-sm text-on-surface outline-none transition-colors",
      "data-[selected=true]:bg-surface-container-highest",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export const CommandShortcut = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("ml-auto text-body-sm tracking-widest text-on-surface-variant", className)}
    {...props}
  />
));
CommandShortcut.displayName = "CommandShortcut";
