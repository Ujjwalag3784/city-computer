/**
 * `/admin/menus` — docs/17 Phase 10's "menus editable in admin with a
 * broken-link check" over the existing `Menu`/`MenuItem` models (docs/06
 * §8, already seeded with HEADER/FOOTER_COMPANY/FOOTER_CATEGORIES/MOBILE
 * in `prisma/seed/content.ts`).
 *
 * A `MenuItem` resolves to exactly one destination: a `categoryId`, a
 * `brandId`, a `pageId`, or the escape-hatch raw `url` — never more than
 * one, so `admin/menus.ts`'s broken-link checker always has an
 * unambiguous single thing to verify per item.
 */
import { z } from "zod";
import { MenuKey } from "@/generated/prisma/client";

export const MENU_ITEM_TARGET_TYPES = ["category", "brand", "page", "url"] as const;
export type MenuItemTargetType = (typeof MENU_ITEM_TARGET_TYPES)[number];

export const menuItemFormSchema = z
  .object({
    menuKey: z.nativeEnum(MenuKey),
    label: z.string().trim().min(1, "Enter a label."),
    targetType: z.enum(MENU_ITEM_TARGET_TYPES),
    categorySlug: z.string().trim().optional(),
    brandSlug: z.string().trim().optional(),
    pageSlug: z.string().trim().optional(),
    url: z.string().trim().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === "category" && !value.categorySlug) {
      ctx.addIssue({ code: "custom", path: ["categorySlug"], message: "Choose a category." });
    }
    if (value.targetType === "brand" && !value.brandSlug) {
      ctx.addIssue({ code: "custom", path: ["brandSlug"], message: "Choose a brand." });
    }
    if (value.targetType === "page" && !value.pageSlug) {
      ctx.addIssue({ code: "custom", path: ["pageSlug"], message: "Choose a page." });
    }
    if (value.targetType === "url" && !value.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a URL." });
    }
  });
export type MenuItemFormInput = z.infer<typeof menuItemFormSchema>;

export const moveMenuItemSchema = z.object({
  itemId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});
