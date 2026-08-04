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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SeoPreview } from "@/components/admin/seo-preview";
import type { AdminBrandRow } from "@/server/services/admin/brand";
import { createBrandAction, updateBrandAction } from "../_actions";

/** Same "reused-once, re-synced-on-open" pattern as `categories/_components/category-form-dialog.tsx` — see that file's doc comment. Presence of `brand` selects edit vs. create mode. */
export interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: AdminBrandRow;
}

export function BrandFormDialog({ open, onOpenChange, brand }: BrandFormDialogProps) {
  const isEdit = Boolean(brand);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(brand?.name ?? "");
    setDescription(brand?.description ?? "");
    setWebsite(brand?.website ?? "");
    setIsFeatured(brand?.isFeatured ?? false);
    setIsActive(brand?.isActive ?? true);
    setMetaTitle(brand?.metaTitle ?? "");
    setMetaDescription(brand?.metaDescription ?? "");
    setError(null);
  }, [open, brand]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        name,
        description: description || undefined,
        website,
        isFeatured,
        isActive,
        metaTitle: metaTitle || undefined,
        metaDescription: metaDescription || undefined,
      };
      const result = isEdit
        ? await updateBrandAction(brand!.id, input)
        : await createBrandAction(input);

      if (!result.ok) {
        setError(result.message ?? "Something went wrong. Please try again.");
        return;
      }

      toast(isEdit ? "Saved." : "Brand added.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit brand" : "Add a brand"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-name">Name</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
              aria-invalid={Boolean(error)}
            />
            <p className="text-body-sm text-on-surface-variant">
              The brand name customers will see, e.g. &ldquo;HP&rdquo;.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-description">Description</Label>
            <Textarea
              id="brand-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
            />
            <p className="text-body-sm text-on-surface-variant">
              Shown on the brand&rsquo;s page. Optional.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-website">Website</Label>
            <Input
              id="brand-website"
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://example.com"
              maxLength={300}
            />
            <p className="text-body-sm text-on-surface-variant">
              The brand&rsquo;s own website. Optional.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="brand-featured">Feature this brand</Label>
              <p className="text-body-sm text-on-surface-variant">
                Featured brands are highlighted on the homepage.
              </p>
            </div>
            <Switch id="brand-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="brand-active">Live on the website</Label>
              <p className="text-body-sm text-on-surface-variant">
                Turn off to hide this from customers without deleting it.
              </p>
            </div>
            <Switch id="brand-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="seo">
              <AccordionTrigger>Search information</AccordionTrigger>
              <AccordionContent>
                {/*
                  Same `SeoPreview` component the category/blog/page admin
                  forms use (see `category-form-dialog.tsx`'s doc comment) —
                  brand wasn't explicitly required by the Phase 11 admin-SEO
                  brief but the fields (and their schema/service support)
                  already existed, and the dialog's own "reused-once, re-
                  synced-on-open" shape is identical to the category dialog's,
                  so wiring it here was a clean, consistent addition rather
                  than an awkward fit. Collapsed by default, same reasoning
                  as the category dialog.
                */}
                <SeoPreview
                  pageUrl={`citycomputer.com.np/b/${brand?.slug ?? (name ? name.toLowerCase().replace(/\s+/g, "-") : "...")}`}
                  pageTitle={metaTitle}
                  onPageTitleChange={setMetaTitle}
                  searchDescription={metaDescription}
                  onSearchDescriptionChange={setMetaDescription}
                  productNameForHint={name}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

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
