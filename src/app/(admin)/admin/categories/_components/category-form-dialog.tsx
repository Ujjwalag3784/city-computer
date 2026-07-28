"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { AdminCategoryNode } from "@/server/services/admin/category";
import { createCategoryAction, updateCategoryAction } from "../_actions";

/**
 * The one form both "Add a category" and "Edit category" use — docs/09-
 * ADMIN-DAD-MODE.md §11's "never more than ~7 fields visible in one
 * group" is why this only surfaces the three fields an owner actually
 * touches day to day (name, description, "show in menu"/"live"). `Category`
 * also has `iconName` and `showInFooter` — preserved untouched from
 * whatever they already were rather than exposed here; a category rarely
 * needs either changed, and every extra field is an extra thing to
 * explain per docs/09 §2.2's "every field that isn't obvious gets helper
 * text" rule.
 *
 * `parentId`/`category` together select the mode: pass `category` to
 * edit, omit it (with a `parentId`, possibly `null` for a top-level
 * category) to create a new one under that parent. The dialog is mounted
 * once by the page and reused for every row — `useEffect` below
 * re-syncs its fields to whichever target it was just opened for, since
 * React state set once at mount wouldn't otherwise notice `category`
 * changing while the dialog stays closed in between.
 */
export interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  category?: AdminCategoryNode;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  parentId,
  category,
}: CategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showInNav, setShowInNav] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setShowInNav(category?.showInNav ?? true);
    setIsActive(category?.isActive ?? true);
    setError(null);
  }, [open, category]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateCategoryAction(category!.id, {
            name,
            description: description || undefined,
            iconName: category!.iconName ?? undefined,
            showInNav,
            showInFooter: category!.showInFooter,
            isActive,
            metaTitle: category!.metaTitle ?? undefined,
            metaDescription: category!.metaDescription ?? undefined,
          })
        : await createCategoryAction({
            name,
            parentId,
            description: description || undefined,
            showInNav,
            isActive,
          });

      if (!result.ok) {
        setError(result.message ?? "Something went wrong. Please try again.");
        return;
      }

      toast(isEdit ? "Saved." : "Category added.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "Add a category"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              aria-invalid={Boolean(error)}
            />
            <p className="text-body-sm text-on-surface-variant">
              The name customers will see, e.g. &ldquo;Gaming Laptops&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
            />
            <p className="text-body-sm text-on-surface-variant">
              Shown at the top of the category page. Optional.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="category-show-in-nav">Show in menu</Label>
              <p className="text-body-sm text-on-surface-variant">
                Customers can find this from the main menu.
              </p>
            </div>
            <Switch id="category-show-in-nav" checked={showInNav} onCheckedChange={setShowInNav} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="category-active">Live on the website</Label>
              <p className="text-body-sm text-on-surface-variant">
                Turn off to hide this from customers without deleting it.
              </p>
            </div>
            <Switch id="category-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error && (
            <p role="alert" className="text-body-sm text-error">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
