/**
 * `/admin/campaigns` ("Offers & banners") — admin CRUD over the
 * `Promotion` model. **Scope cut, flagged rather than faked:** this
 * covers `Promotion`'s own metadata (name, type, priority, stacking,
 * dates, live/off) only. `PromotionRule` — the condition/action rows
 * that would make a campaign actually discount anything at checkout — is
 * NOT editable from this screen. Two independent reasons stack here:
 * (1) `commerce/coupon.ts`'s own doc comment already flagged since Phase
 * 6 that `Promotion` "powers banners that currently link nowhere" —
 * there is no promotions *evaluator* wired into the cart/checkout pricing
 * path at all yet, so a rich rule editor here would configure an engine
 * nothing calls; (2) `PromotionType` spans five very different shapes
 * (PERCENTAGE, FIXED, BUY_X_GET_Y, BUNDLE, TIERED) whose condition/action
 * JSON payloads (`PromotionRule.conditionValue`/`actionValue`) would each
 * need their own structured, non-technical form to meet docs/09's "no
 * raw JSON" bar — real work, correctly out of scope for this pass's
 * budget. A developer can still seed `PromotionRule` rows directly for
 * any campaign created here. See PROGRESS.md's Phase 9 section.
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { AdminCampaignListQuery, CampaignFormInput } from "@/lib/validation/admin/campaigns";

export interface AdminCampaignListItem {
  id: string;
  name: string;
  type: string;
  priority: number;
  stackable: boolean;
  isActive: boolean;
  ruleCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
}

const CAMPAIGN_LIST_PAGE_SIZE = 20;

function buildListWhere(query: AdminCampaignListQuery): Prisma.PromotionWhereInput {
  const clauses: Prisma.PromotionWhereInput[] = [];
  if (query.q) clauses.push({ name: { contains: query.q, mode: "insensitive" } });
  if (query.filter === "active") clauses.push({ isActive: true });
  if (query.filter === "inactive") clauses.push({ isActive: false });
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listCampaignsForAdmin(
  query: AdminCampaignListQuery,
): Promise<{ items: AdminCampaignListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query);
  const [rows, total] = await Promise.all([
    db.promotion.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * CAMPAIGN_LIST_PAGE_SIZE,
      take: CAMPAIGN_LIST_PAGE_SIZE + 1,
      include: { _count: { select: { rules: true } } },
    }),
    db.promotion.count({ where }),
  ]);
  const hasNext = rows.length > CAMPAIGN_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, CAMPAIGN_LIST_PAGE_SIZE).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      priority: p.priority,
      stackable: p.stackable,
      isActive: p.isActive,
      ruleCount: p._count.rules,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
    })),
    total,
    hasNext,
  };
}

export async function getCampaignForAdmin(campaignId: string) {
  const promotion = await db.promotion.findUnique({ where: { id: campaignId } });
  if (!promotion) throw new NotFoundError("Campaign");
  return promotion;
}

function toCampaignData(input: CampaignFormInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    priority: input.priority,
    stackable: input.stackable,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive,
  } satisfies Prisma.PromotionUncheckedCreateInput;
}

export async function createCampaign(
  input: CampaignFormInput,
  actor: AuditActor,
): Promise<{ id: string }> {
  const promotion = await db.promotion.create({ data: toCampaignData(input) });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "campaign.created",
    entityType: "Promotion",
    entityId: promotion.id,
    after: { name: promotion.name, type: promotion.type },
  });
  return { id: promotion.id };
}

export async function updateCampaign(
  campaignId: string,
  input: CampaignFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.promotion.findUnique({ where: { id: campaignId } });
  if (!before) throw new NotFoundError("Campaign");

  const data = toCampaignData(input);
  await db.promotion.update({ where: { id: campaignId }, data });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "campaign.updated",
    entityType: "Promotion",
    entityId: campaignId,
    before: { name: before.name, isActive: before.isActive },
    after: { name: data.name, isActive: data.isActive },
  });
}

export async function setCampaignActive(
  campaignId: string,
  isActive: boolean,
  actor: AuditActor,
): Promise<void> {
  const before = await db.promotion.findUnique({
    where: { id: campaignId },
    select: { isActive: true },
  });
  if (!before) throw new NotFoundError("Campaign");

  await db.promotion.update({ where: { id: campaignId }, data: { isActive } });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isActive ? "campaign.activated" : "campaign.deactivated",
    entityType: "Promotion",
    entityId: campaignId,
    before: { isActive: before.isActive },
    after: { isActive },
  });
}
