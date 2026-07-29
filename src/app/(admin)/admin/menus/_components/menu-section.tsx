"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { MenuKey } from "@/generated/prisma/client";
import type { AdminMenuItem } from "@/server/services/admin/menus";
import type { MenuItemTargetType } from "@/lib/validation/admin/menus";
import { createMenuItemAction, deleteMenuItemAction, moveMenuItemAction } from "../_actions";

export function MenuSection({
  menuKey,
  name,
  items,
}: {
  menuKey: MenuKey;
  name: string;
  items: AdminMenuItem[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [targetType, setTargetType] = useState<MenuItemTargetType>("url");
  const [targetValue, setTargetValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await createMenuItemAction({
        menuKey,
        label,
        targetType,
        isActive: true,
        categorySlug: targetType === "category" ? targetValue : undefined,
        brandSlug: targetType === "brand" ? targetValue : undefined,
        pageSlug: targetType === "page" ? targetValue : undefined,
        url: targetType === "url" ? targetValue : undefined,
      });
      if (!result.ok) {
        toast(result.message ?? "Couldn't add this menu item.");
        return;
      }
      toast("Menu item added.");
      setLabel("");
      setTargetValue("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm("Remove this menu item?")) return;
    const result = await deleteMenuItemAction(itemId);
    if (!result.ok) toast(result.message ?? "Couldn't remove this item.");
    else router.refresh();
  }

  async function handleMove(itemId: string, direction: "up" | "down") {
    const result = await moveMenuItemAction({ itemId, direction });
    if (!result.ok) toast(result.message ?? "Couldn't reorder.");
    else router.refresh();
  }

  return (
    <Card variant="surface">
      <CardContent className="flex flex-col gap-4 py-4">
        <h2 className="text-headline-sm text-on-surface">{name}</h2>

        <div className="flex flex-col gap-2">
          {items.length === 0 && (
            <p className="text-body-sm text-on-surface-variant">No items yet.</p>
          )}
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded border border-glass-stroke px-3 py-2"
            >
              <div>
                <p className="text-body-sm font-medium text-on-surface">{item.label}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {item.targetType}: {item.targetLabel}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!item.isActive && <Badge variant="glass">Hidden</Badge>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMove(item.id, "up")}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMove(item.id, "down")}
                  disabled={index === items.length - 1}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-end gap-3 border-t border-glass-stroke pt-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${menuKey}-label`}>Label</Label>
            <Input
              id={`${menuKey}-label`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${menuKey}-type`}>Links to</Label>
            <Select
              value={targetType}
              onValueChange={(v) => setTargetType(v as MenuItemTargetType)}
            >
              <SelectTrigger id={`${menuKey}-type`} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="page">Page</SelectItem>
                <SelectItem value="url">Custom URL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${menuKey}-value`}>
              {targetType === "url" ? "URL" : `${targetType} slug`}
            </Label>
            <Input
              id={`${menuKey}-value`}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={targetType === "url" ? "/build" : "laptops"}
              required
              className="w-48"
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add item"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
