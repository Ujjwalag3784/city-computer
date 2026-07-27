import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class strings, resolving conflicting Tailwind utilities in favour
 * of the later one (e.g. `cn("p-2", condition && "p-4")` keeps `p-4` when
 * `condition` is true). The one class-merging helper every component uses —
 * see docs/04-REPOSITORY-STRUCTURE.md §2 (`lib/utils.ts cn(), typed helpers
 * only — no dumping ground`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
