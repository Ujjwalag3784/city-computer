/**
 * `/admin/service` ("Repair jobs") — docs/09-ADMIN-DAD-MODE.md §3 (OWNER,
 * MANAGER, TECHNICIAN, STAFF) over the existing `ServiceTicket` model
 * (docs/06 §9).
 */
import { z } from "zod";
import { ServiceDeviceType, TicketPriority, TicketStatus } from "@/generated/prisma/client";

export const ADMIN_TICKET_FILTERS = [
  "needs-attention",
  "ready-for-pickup",
  "collected",
  "cancelled",
  "all",
] as const;
export type AdminTicketFilter = (typeof ADMIN_TICKET_FILTERS)[number];

export const adminTicketListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(ADMIN_TICKET_FILTERS).default("needs-attention"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminTicketListQuery = z.infer<typeof adminTicketListQuerySchema>;

export const createTicketSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name."),
  phone: z.string().trim().min(7, "Enter a phone number."),
  email: z.string().trim().email().optional().or(z.literal("")),
  branchId: z.string().min(1, "Choose which branch is receiving this device."),
  deviceType: z.nativeEnum(ServiceDeviceType),
  brand: z.string().trim().min(1, "Enter the device brand."),
  model: z.string().trim().optional(),
  serialNumber: z.string().trim().optional(),
  issueCategory: z.string().trim().min(1, "Describe the type of problem, e.g. 'Won't turn on'."),
  issueDescription: z.string().trim().min(3, "Describe the problem in a sentence or two."),
  accessoriesReceived: z.array(z.string()).default([]),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.NORMAL),
  warrantyClaim: z.boolean().default(false),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const transitionTicketSchema = z.object({
  ticketId: z.string().min(1),
  to: z.nativeEnum(TicketStatus),
  note: z.string().trim().max(1000).optional(),
});

export const updateTicketNotesSchema = z.object({
  ticketId: z.string().min(1),
  internalNotes: z.string().trim().max(4000),
});
