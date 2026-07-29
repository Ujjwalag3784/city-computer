/**
 * `/admin/pages` — CRUD over `Page` (docs/17 Phase 10: "CMS pages with
 * templates"). Same "validate content against the Tiptap allow-list
 * before it's ever written" rule as `admin/blog.ts` — see that file's own
 * doc comment for the full reasoning; not repeated per-function here.
 */
import "server-only";
import { db } from "@/server/db";
import { type Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { parseTiptapDocument } from "@/lib/tiptap/schema";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { PageFormInput } from "@/lib/validation/admin/pages";

export interface AdminPageListItem {
  id: string;
  title: string;
  slug: string;
  template: string;
  status: string;
  updatedAt: Date;
}

export async function listPagesForAdmin(): Promise<AdminPageListItem[]> {
  const pages = await db.page.findMany({
    where: { deletedAt: null },
    orderBy: { title: "asc" },
  });
  return pages.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    template: p.template,
    status: p.status,
    updatedAt: p.updatedAt,
  }));
}

export interface AdminPageDetail {
  id: string;
  title: string;
  slug: string;
  content: unknown;
  template: string;
  status: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

export async function getPageForAdmin(pageId: string): Promise<AdminPageDetail> {
  const page = await db.page.findFirst({ where: { id: pageId, deletedAt: null } });
  if (!page) throw new NotFoundError("Page");
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content,
    template: page.template,
    status: page.status,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
  };
}

function parseAndValidateContent(rawContent: unknown) {
  const parsed = parseTiptapDocument(rawContent);
  if (!parsed) {
    throw new ValidationError([
      {
        field: "content",
        code: "invalid_content",
        message:
          "This page's content couldn't be saved safely. Try removing any unusual formatting and save again.",
      },
    ]);
  }
  return parsed;
}

export async function createPage(input: PageFormInput, actor: AuditActor): Promise<{ id: string }> {
  const existingSlug = await db.page.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ValidationError([
      {
        field: "slug",
        code: "duplicate",
        message: "This URL slug is already used by another page.",
      },
    ]);
  }
  const contentDoc = parseAndValidateContent(input.content);

  const page = await db.page.create({
    data: {
      title: input.title.trim(),
      slug: input.slug,
      content: contentDoc as unknown as Prisma.InputJsonValue,
      template: input.template,
      status: input.status,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "page.created",
    entityType: "Page",
    entityId: page.id,
    after: { title: page.title, status: page.status },
  });

  return { id: page.id };
}

export async function updatePage(
  pageId: string,
  input: PageFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.page.findFirst({ where: { id: pageId, deletedAt: null } });
  if (!before) throw new NotFoundError("Page");

  if (input.slug !== before.slug) {
    const clash = await db.page.findUnique({ where: { slug: input.slug } });
    if (clash) {
      throw new ValidationError([
        {
          field: "slug",
          code: "duplicate",
          message: "This URL slug is already used by another page.",
        },
      ]);
    }
  }

  const contentDoc = parseAndValidateContent(input.content);

  await db.page.update({
    where: { id: pageId },
    data: {
      title: input.title.trim(),
      slug: input.slug,
      content: contentDoc as unknown as Prisma.InputJsonValue,
      template: input.template,
      status: input.status,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "page.updated",
    entityType: "Page",
    entityId: pageId,
    before: { status: before.status },
    after: { status: input.status },
  });
}

export async function deletePage(pageId: string, actor: AuditActor): Promise<void> {
  const before = await db.page.findFirst({ where: { id: pageId, deletedAt: null } });
  if (!before) throw new NotFoundError("Page");

  await db.page.update({ where: { id: pageId }, data: { deletedAt: new Date() } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "page.deleted",
    entityType: "Page",
    entityId: pageId,
    before: { title: before.title },
  });
}
