/**
 * `/admin/faqs` — docs/17 Phase 10, over the existing `Faq` model (docs/06
 * §8, comment: "Feeds FAQPage schema"). This pass scopes FAQs to the
 * general list only — `productId`/`categoryId` scoping (the model
 * supports both) has no admin picker UI yet, same "comma-separated codes,
 * a picker is coming later" gap already flagged for blog categories/
 * related products; left fully unscoped (both null) here rather than
 * half-built.
 */
import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { FaqFormInput } from "@/lib/validation/admin/faqs";

export interface AdminFaqItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  isActive: boolean;
  position: number;
}

export async function listFaqsForAdmin(): Promise<AdminFaqItem[]> {
  const faqs = await db.faq.findMany({ orderBy: { position: "asc" } });
  return faqs.map((f) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    category: f.category,
    isActive: f.isActive,
    position: f.position,
  }));
}

export async function createFaq(input: FaqFormInput, actor: AuditActor): Promise<{ id: string }> {
  const maxPosition = await db.faq.aggregate({ _max: { position: true } });
  const faq = await db.faq.create({
    data: {
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category?.trim() || null,
      isActive: input.isActive,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "faq.created",
    entityType: "Faq",
    entityId: faq.id,
    after: { question: faq.question },
  });
  return { id: faq.id };
}

export async function updateFaq(
  faqId: string,
  input: FaqFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.faq.findUnique({ where: { id: faqId } });
  if (!before) throw new NotFoundError("FAQ");

  await db.faq.update({
    where: { id: faqId },
    data: {
      question: input.question.trim(),
      answer: input.answer.trim(),
      category: input.category?.trim() || null,
      isActive: input.isActive,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "faq.updated",
    entityType: "Faq",
    entityId: faqId,
    before: { question: before.question },
    after: { question: input.question },
  });
}

export async function deleteFaq(faqId: string, actor: AuditActor): Promise<void> {
  const before = await db.faq.findUnique({ where: { id: faqId } });
  if (!before) throw new NotFoundError("FAQ");

  await db.faq.delete({ where: { id: faqId } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "faq.deleted",
    entityType: "Faq",
    entityId: faqId,
    before: { question: before.question },
  });
}

export async function moveFaq(
  faqId: string,
  direction: "up" | "down",
  actor: AuditActor,
): Promise<void> {
  const faq = await db.faq.findUnique({ where: { id: faqId } });
  if (!faq) throw new NotFoundError("FAQ");

  const neighbour = await db.faq.findFirst({
    where: { position: direction === "up" ? { lt: faq.position } : { gt: faq.position } },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbour) return;

  await db.$transaction([
    db.faq.update({ where: { id: faq.id }, data: { position: neighbour.position } }),
    db.faq.update({ where: { id: neighbour.id }, data: { position: faq.position } }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "faq.reordered",
    entityType: "Faq",
    entityId: faqId,
    before: { position: faq.position },
    after: { position: neighbour.position },
  });
}
