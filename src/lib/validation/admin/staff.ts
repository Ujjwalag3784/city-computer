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
