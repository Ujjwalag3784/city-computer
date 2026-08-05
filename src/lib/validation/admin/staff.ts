/**
 * `/admin/users` ("Staff accounts") — docs/09-ADMIN-DAD-MODE.md §12,
 * OWNER only. One role per staff member (see `admin/staff.ts`'s own doc
 * comment for why, given `UserRole` is schema-modelled as many-to-many).
 */
import { z } from "zod";

export const STAFF_ROLE_KEYS = [
  "OWNER",
  "MANAGER",
  "STAFF",
  "CONTENT_EDITOR",
  "SUPPORT",
  "TECHNICIAN",
] as const;
export type StaffRoleKey = (typeof STAFF_ROLE_KEYS)[number];

/**
 * docs/09 §12's plain-language role table — "with each role's description
 * visible while choosing."
 *
 * This lives here, next to the `STAFF_ROLE_KEYS` it is keyed by, rather
 * than in `@/server/services/admin/staff` where it started, because
 * `staff-role-select.tsx` is a `"use client"` component that renders these
 * labels. That service module carries `import "server-only"` (correctly —
 * it talks to the database), so reading the labels from it pulled
 * `@/server/db`, `@/env` and the audit-log service into the client bundle
 * and failed the first real production build. It is plain presentation copy
 * keyed by a plain enum, so `lib/**` is the right home; the service module
 * re-exports it unchanged for the server pages that already import it from
 * there.
 */
export const STAFF_ROLE_DESCRIPTIONS: Record<StaffRoleKey, { label: string; description: string }> =
  {
    OWNER: {
      label: "Owner",
      description: "Can do everything, including changing settings and adding staff.",
    },
    MANAGER: {
      label: "Manager",
      description:
        "Can manage products, orders, stock and content. Cannot change settings or add staff.",
    },
    STAFF: {
      label: "Shop staff",
      description: "Can process orders and update stock. Cannot change prices or delete anything.",
    },
    CONTENT_EDITOR: {
      label: "Content writer",
      description: "Can write blog posts and edit website pages. Cannot see orders or customers.",
    },
    SUPPORT: {
      label: "Customer support",
      description:
        "Can view orders and customers and reply to messages. Cannot change anything else.",
    },
    TECHNICIAN: { label: "Repair technician", description: "Can manage repair jobs only." },
  };

export const createStaffSchema = z
  .object({
    name: z.string().trim().min(2, "Enter their name."),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().min(7).optional().or(z.literal("")),
    roleKey: z.enum(STAFF_ROLE_KEYS),
  })
  .refine((data) => data.email || data.phone, {
    message: "Enter a phone number or an email address.",
    path: ["email"],
  });
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffRoleSchema = z.object({
  userId: z.string().min(1),
  roleKey: z.enum(STAFF_ROLE_KEYS),
});

export const setStaffStatusSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
});
