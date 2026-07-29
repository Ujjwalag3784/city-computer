/**
 * Public service-desk forms (docs/17 Phase 10: service booking + public
 * status lookup). Kept separate from `admin/service-tickets.ts`'s
 * `createTicketSchema` — the public form never accepts `priority`,
 * `assignedToId`, or anything staff-only, and the phone-gate schema below
 * has no admin equivalent at all.
 */
import { z } from "zod";
import { ServiceDeviceType } from "@/generated/prisma/client";

export const bookServiceTicketSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(7, "Enter a phone number."),
  email: z.string().trim().email().optional().or(z.literal("")),
  branchSlug: z.string().min(1, "Choose which branch you'll bring the device to."),
  deviceType: z.nativeEnum(ServiceDeviceType),
  brand: z.string().trim().min(1, "Enter the device brand."),
  model: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  issueCategory: z.string().trim().min(1, "Describe the type of problem, e.g. 'Won't turn on'."),
  issueDescription: z.string().trim().min(3, "Describe the problem in a sentence or two."),
  accessoriesReceived: z.array(z.string()).default([]),
  warrantyClaim: z.boolean().default(false),
});
export type BookServiceTicketInput = z.infer<typeof bookServiceTicketSchema>;

/**
 * The public status-lookup gate — docs/06 §9's own comment: "requires
 * ticket number plus the last 4 digits of the phone... otherwise ticket
 * numbers are enumerable." Both fields are required by this schema, never
 * just the ticket number alone.
 */
export const ticketStatusLookupSchema = z.object({
  ticketNumber: z.string().trim().min(1, "Enter your ticket number."),
  phoneLastFour: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits of the phone number used to book this repair."),
});
export type TicketStatusLookupInput = z.infer<typeof ticketStatusLookupSchema>;
