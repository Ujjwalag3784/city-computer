"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CouponType, CouponAppliesTo } from "@/generated/prisma/client";
import { createCouponAction, updateCouponAction } from "../_actions";

export interface CouponFormValues {
  code: string;
  description: string;
  type: CouponType;
  value: number | "";
  minOrderRupees: number | "";
  maxDiscountRupees: number | "";
  usageLimit: number | "";
  usageLimitPerCustomer: number | "";
  startsAt: string;
  endsAt: string;
  appliesTo: CouponAppliesTo;
  targetIdsText: string;
  excludeDiscounted: boolean;
  firstOrderOnly: boolean;
  isActive: boolean;
}

export const EMPTY_COUPON_FORM: CouponFormValues = {
  code: "",
  description: "",
  type: CouponType.PERCENTAGE,
  value: "",
  minOrderRupees: "",
  maxDiscountRupees: "",
  usageLimit: "",
  usageLimitPerCustomer: "",
  startsAt: "",
  endsAt: "",
  appliesTo: CouponAppliesTo.ALL,
  targetIdsText: "",
  excludeDiscounted: false,
  firstOrderOnly: false,
  isActive: true,
};

export interface CouponFormProps {
  couponId?: string;
  initialValues: CouponFormValues;
}

/**
 * Add/edit form for a single discount code — docs/09-ADMIN-DAD-MODE.md §2.2's
 * "every field that isn't obvious gets one line of helper text" rule, one
 * screen rather than a wizard since a coupon has far fewer fields than a
 * product.
 *
 * `targetIdsText` (comma-separated product/brand/category ids) is a real,
 * flagged simplification: docs/09's product-picker convention (a
 * searchable multi-select, same as the product wizard's category tree
 * picker) is not built here — see PROGRESS.md's Phase 9 note. Only shown
 * at all when "Applies to" isn't "Everything", so the common case (a
 * storewide code) never has to see it.
 */
export function CouponForm({ couponId, initialValues }: CouponFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<CouponFormValues>(initialValues);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues({});
    try {
      const payload = {
        code: values.code,
        description: values.description || undefined,
        type: values.type,
        value: values.value === "" ? 0 : values.value,
        minOrderRupees: values.minOrderRupees === "" ? undefined : values.minOrderRupees,
        maxDiscountRupees: values.maxDiscountRupees === "" ? undefined : values.maxDiscountRupees,
        usageLimit: values.usageLimit === "" ? undefined : values.usageLimit,
        usageLimitPerCustomer:
          values.usageLimitPerCustomer === "" ? undefined : values.usageLimitPerCustomer,
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
        appliesTo: values.appliesTo,
        targetIds: values.targetIdsText
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
        excludeDiscounted: values.excludeDiscounted,
        firstOrderOnly: values.firstOrderOnly,
        isActive: values.isActive,
      };

      const result = couponId
        ? await updateCouponAction(couponId, payload)
        : await createCouponAction(payload);

      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        toast(result.message ?? "Couldn't save this discount code. Please check the form.");
        return;
      }

      toast(couponId ? "Discount code saved." : "Discount code created.");
      router.push("/admin/coupons");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coupon-code">Discount code</Label>
        <Input
          id="coupon-code"
          value={values.code}
          onChange={(e) => update("code", e.target.value.toUpperCase())}
          placeholder="e.g. DASHAIN10"
          required
        />
        <p className="text-body-sm text-on-surface-variant">
          What customers type at checkout. Letters, numbers, and hyphens only.
        </p>
        {issues.code && <p className="text-body-sm text-danger">{issues.code}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coupon-description">Description</Label>
        <Input
          id="coupon-description"
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="e.g. Dashain sale — 10% off everything"
        />
        <p className="text-body-sm text-on-surface-variant">
          For your own reference — customers don&apos;t see this.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coupon-type">Discount type</Label>
        <Select value={values.type} onValueChange={(v) => update("type", v as CouponType)}>
          <SelectTrigger id="coupon-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CouponType.PERCENTAGE}>Percentage off</SelectItem>
            <SelectItem value={CouponType.FIXED_AMOUNT}>Fixed amount off</SelectItem>
            <SelectItem value={CouponType.FREE_SHIPPING}>Free shipping</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {values.type !== CouponType.FREE_SHIPPING && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-value">
            {values.type === CouponType.PERCENTAGE ? "Percentage off" : "Amount off (रु)"}
          </Label>
          <Input
            id="coupon-value"
            type="number"
            min={0}
            value={values.value}
            onChange={(e) => update("value", e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
          {issues.value && <p className="text-body-sm text-danger">{issues.value}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-min-order">Minimum order (रु)</Label>
          <Input
            id="coupon-min-order"
            type="number"
            min={0}
            value={values.minOrderRupees}
            onChange={(e) =>
              update("minOrderRupees", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank for no minimum.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-max-discount">Maximum discount (रु)</Label>
          <Input
            id="coupon-max-discount"
            type="number"
            min={0}
            value={values.maxDiscountRupees}
            onChange={(e) =>
              update("maxDiscountRupees", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <p className="text-body-sm text-on-surface-variant">
            Caps a percentage discount. Leave blank for no cap.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-usage-limit">Total times this can be used</Label>
          <Input
            id="coupon-usage-limit"
            type="number"
            min={1}
            value={values.usageLimit}
            onChange={(e) =>
              update("usageLimit", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank for unlimited.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-usage-limit-per-customer">Times per customer</Label>
          <Input
            id="coupon-usage-limit-per-customer"
            type="number"
            min={1}
            value={values.usageLimitPerCustomer}
            onChange={(e) =>
              update("usageLimitPerCustomer", e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank for unlimited.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-starts-at">Starts</Label>
          <Input
            id="coupon-starts-at"
            type="date"
            value={values.startsAt}
            onChange={(e) => update("startsAt", e.target.value)}
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank to start right away.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-ends-at">Ends</Label>
          <Input
            id="coupon-ends-at"
            type="date"
            value={values.endsAt}
            onChange={(e) => update("endsAt", e.target.value)}
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank to never expire.</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coupon-applies-to">Applies to</Label>
        <Select
          value={values.appliesTo}
          onValueChange={(v) => update("appliesTo", v as CouponAppliesTo)}
        >
          <SelectTrigger id="coupon-applies-to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CouponAppliesTo.ALL}>Everything</SelectItem>
            <SelectItem value={CouponAppliesTo.CATEGORY}>Specific categories</SelectItem>
            <SelectItem value={CouponAppliesTo.BRAND}>Specific brands</SelectItem>
            <SelectItem value={CouponAppliesTo.PRODUCT}>Specific products</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {values.appliesTo !== CouponAppliesTo.ALL && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coupon-target-ids">
            {values.appliesTo === CouponAppliesTo.CATEGORY
              ? "Category codes"
              : values.appliesTo === CouponAppliesTo.BRAND
                ? "Brand codes"
                : "Product codes"}
          </Label>
          <Textarea
            id="coupon-target-ids"
            value={values.targetIdsText}
            onChange={(e) => update("targetIdsText", e.target.value)}
            placeholder="Paste one or more codes, separated by commas"
          />
          <p className="text-body-sm text-on-surface-variant">
            Ask a developer for the codes if you&apos;re not sure — a proper picker is coming later.
          </p>
          {issues.targetIds && <p className="text-body-sm text-danger">{issues.targetIds}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Only on a first order</p>
          <p className="text-body-sm text-on-surface-variant">
            Only works for customers who haven&apos;t ordered before.
          </p>
        </div>
        <Switch
          checked={values.firstOrderOnly}
          onCheckedChange={(v) => update("firstOrderOnly", v)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Skip products already on offer</p>
          <p className="text-body-sm text-on-surface-variant">
            Don&apos;t discount products that already have an offer price.
          </p>
        </div>
        <Switch
          checked={values.excludeDiscounted}
          onCheckedChange={(v) => update("excludeDiscounted", v)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Live</p>
          <p className="text-body-sm text-on-surface-variant">
            Turn off to stop customers using this code without deleting it.
          </p>
        </div>
        <Switch checked={values.isActive} onCheckedChange={(v) => update("isActive", v)} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/coupons")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : couponId ? "Save changes" : "Create discount code"}
        </Button>
      </div>
    </form>
  );
}
