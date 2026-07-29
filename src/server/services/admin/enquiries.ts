/**
 * `/admin/enquiries` ("Messages") — list/filter over the existing
 * `Enquiry` model plus `setEnquiryStatus`, the one mutation this screen
 * owns. **Flagged, not faked:** `Enquiry` has no reply-text field in the
 * schema (unlike `Review.adminReply`) — there is nowhere to store a
 * transcript of what staff said back to the customer, and no outbound
 * email/SMS sending service exists anywhere in this codebase yet either
 * (grepped: only `auth/verify-email.ts`, which is its own narrow flow,
 * not a general mailer). So "replying" here means contacting the
 * customer by phone/email outside the system (the row's own `tel:`/
 * `mailto:` links) and then marking the message Replied/Closed — an
 * honest reflection of what this schema and this codebase can actually
 * do today, not a silently-missing feature.
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { EnquiryStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { AdminEnquiryFilter, AdminEnquiryListQuery } from "@/lib/validation/admin/enquiries";

export interface AdminEnquiryListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  type: string;
  status: EnquiryStatus;
  productName: string | null;
  createdAt: Date;
}

const ENQUIRY_LIST_PAGE_SIZE = 20;

function buildListWhere(query: AdminEnquiryListQuery): Prisma.EnquiryWhereInput {
  const clauses: Prisma.EnquiryWhereInput[] = [];
  if (query.q) {
    clauses.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
        { subject: { contains: query.q, mode: "insensitive" } },
        { message: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const filter: AdminEnquiryFilter = query.filter;
  if (filter === "unread") clauses.push({ status: EnquiryStatus.UNREAD });
  else if (filter === "read") clauses.push({ status: EnquiryStatus.READ });
  else if (filter === "replied") clauses.push({ status: EnquiryStatus.REPLIED });
  else if (filter === "closed") clauses.push({ status: EnquiryStatus.CLOSED });
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listEnquiriesForAdmin(
  query: AdminEnquiryListQuery,
): Promise<{ items: AdminEnquiryListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query);
  const [rows, total] = await Promise.all([
    db.enquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * ENQUIRY_LIST_PAGE_SIZE,
      take: ENQUIRY_LIST_PAGE_SIZE + 1,
      include: { product: { select: { name: true } } },
    }),
    db.enquiry.count({ where }),
  ]);
  const hasNext = rows.length > ENQUIRY_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, ENQUIRY_LIST_PAGE_SIZE).map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      phone: e.phone,
      subject: e.subject,
      message: e.message,
      type: e.type,
      status: e.status,
      productName: e.product?.name ?? null,
      createdAt: e.createdAt,
    })),
    total,
    hasNext,
  };
}

export async function setEnquiryStatus(
  enquiryId: string,
  status: EnquiryStatus,
  actor: AuditActor,
): Promise<void> {
  const before = await db.enquiry.findUnique({
    where: { id: enquiryId },
    select: { status: true },
  });
  if (!before) throw new NotFoundError("Message");

  await db.enquiry.update({ where: { id: enquiryId }, data: { status } });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "enquiry.status_changed",
    entityType: "Enquiry",
    entityId: enquiryId,
    before: { status: before.status },
    after: { status },
  });
}
