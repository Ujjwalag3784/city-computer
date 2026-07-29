/**
 * `/admin/branches` ("Stores") — docs/09-ADMIN-DAD-MODE.md §3, OWNER only.
 * `Branch` + `BranchHours` (docs/06 §5).
 */
import { z } from "zod";
import { Province } from "@/generated/prisma/client";

const dayHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
});

export const branchFormSchema = z.object({
  name: z.string().trim().min(2, "Give this store a name."),
  addressLine: z.string().trim().min(3, "Enter the street address."),
  district: z.string().trim().min(2, "Enter the district."),
  province: z.nativeEnum(Province),
  phone: z.string().trim().min(7, "Enter a phone number."),
  email: z.string().trim().email().optional().or(z.literal("")),
  isPickupEnabled: z.boolean().default(true),
  isDefaultFulfilment: z.boolean().default(false),
  isActive: z.boolean().default(true),
  hours: z.array(dayHoursSchema).length(7),
});
export type BranchFormInput = z.infer<typeof branchFormSchema>;
