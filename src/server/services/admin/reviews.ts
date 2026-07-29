/**
 * `/admin/reviews` moderation queue — list/filter over the existing
 * `Review` model plus the two mutations this screen owns
 * (`setReviewStatus`, `replyToReview`). Every submitted review starts
 * `PENDING` (the model's own default) and is invisible on the storefront
 * PDP until an OWNER/MANAGER approves it here — this file is that first
 * admin-side gate, mirroring the shape of `admin/customers.ts` (list +
 * detail-free row actions + `recordAuditLog` on every write).
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ReviewStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { AdminReviewFilter, AdminReviewListQuery } from "@/lib/validation/admin/reviews";

export interface AdminReviewListItem {
  id: string;
  productId: string;
  productName: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  isVerifiedPurchase: boolean;
  status: ReviewStatus;
  adminReply: string | null;
  createdAt: Date;
}

const REVIEW_LIST_PAGE_SIZE = 20;

function buildListWhere(query: AdminReviewListQuery): Prisma.ReviewWhereInput {
  const clauses: Prisma.ReviewWhereInput[] = [];
  if (query.q) {
    clauses.push({
      OR: [
        { authorName: { contains: query.q, mode: "insensitive" } },
        { body: { contains: query.q, mode: "insensitive" } },
        { product: { is: { name: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }
  const filter: AdminReviewFilter = query.filter;
  if (filter === "needs-approval") clauses.push({ status: ReviewStatus.PENDING });
  else if (filter === "approved") clauses.push({ status: ReviewStatus.APPROVED });
  else if (filter === "rejected") clauses.push({ status: ReviewStatus.REJECTED });
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listReviewsForAdmin(
  query: AdminReviewListQuery,
): Promise<{ items: AdminReviewListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query);
  const [rows, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * REVIEW_LIST_PAGE_SIZE,
      take: REVIEW_LIST_PAGE_SIZE + 1,
      include: { product: { select: { id: true, name: true } } },
    }),
    db.review.count({ where }),
  ]);
  const hasNext = rows.length > REVIEW_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, REVIEW_LIST_PAGE_SIZE).map((r) => ({
      id: r.id,
      productId: r.product.id,
      productName: r.product.name,
      authorName: r.authorName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      isVerifiedPurchase: r.isVerifiedPurchase,
      status: r.status,
      adminReply: r.adminReply,
      createdAt: r.createdAt,
    })),
    total,
    hasNext,
  };
}

export async function setReviewStatus(
  reviewId: string,
  status: ReviewStatus,
  actor: AuditActor,
): Promise<void> {
  const before = await db.review.findUnique({ where: { id: reviewId }, select: { status: true } });
  if (!before) throw new NotFoundError("Review");

  await db.review.update({ where: { id: reviewId }, data: { status } });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action:
      status === ReviewStatus.APPROVED
        ? "review.approved"
        : status === ReviewStatus.REJECTED
          ? "review.rejected"
          : "review.status_changed",
    entityType: "Review",
    entityId: reviewId,
    before: { status: before.status },
    after: { status },
  });
}

export async function replyToReview(
  reviewId: string,
  reply: string,
  actor: AuditActor,
): Promise<void> {
  const before = await db.review.findUnique({
    where: { id: reviewId },
    select: { adminReply: true },
  });
  if (!before) throw new NotFoundError("Review");

  const trimmed = reply.trim();
  await db.review.update({ where: { id: reviewId }, data: { adminReply: trimmed } });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "review.replied",
    entityType: "Review",
    entityId: reviewId,
    before: { adminReply: before.adminReply },
    after: { adminReply: trimmed },
  });
}
