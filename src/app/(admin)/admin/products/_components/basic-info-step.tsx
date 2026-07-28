"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/admin/money-input";
import { discountPercent } from "@/lib/money";
import type { ConditionType } from "@/generated/prisma/client";
import type { BasicInfoFormState } from "../_lib/wizard-types";
import { checkDuplicateProductNameAction } from "../_actions";
import type { SimilarProductCandidate } from "@/server/services/admin/product";

/**
 * Step 1 — "Basic information" (docs/09-ADMIN-DAD-MODE.md §5.1).
 *
 * Category picker scope note: the doc calls for a "tree picker", but this
 * codebase has no tree-picker primitive (only `Combobox`, a flat
 * searchable list — `admin/products/_actions.ts`'s `listCategoryOptionsAction`
 * flattens the real category tree into indented labels so the hierarchy
 * stays visible). Building a real expand/collapse tree widget is real,
 * separate work; a flat searchable list of ~50-200 categories is still
 * fast to search and is what `Combobox` already gives us for free.
 * "Also show in" (docs' multi-select) is a plain scrollable checkbox list
 * for the same reason — no multi-select primitive exists yet either.
 *
 * Duplicate-name detection: this component owns that check itself
 * (`checkDuplicateProductNameAction`, called `onBlur`) rather than the
 * orchestrator, since nothing else in the wizard needs the result.
 */
export interface BasicInfoStepProps {
  value: BasicInfoFormState;
  onChange: (value: BasicInfoFormState) => void;
  brandOptions: ComboboxOption[];
  categoryOptions: ComboboxOption[];
  existingProductId?: string;
}

const CONDITION_OPTIONS: { value: ConditionType; label: string }[] = [
  { value: "NEW" as ConditionType, label: "New" },
  { value: "REFURBISHED" as ConditionType, label: "Refurbished" },
  { value: "OPEN_BOX" as ConditionType, label: "Open box" },
];

export function BasicInfoStep({
  value,
  onChange,
  brandOptions,
  categoryOptions,
  existingProductId,
}: BasicInfoStepProps) {
  const [shortTitleTouched, setShortTitleTouched] = useState(Boolean(value.shortTitle));
  const [duplicates, setDuplicates] = useState<SimilarProductCandidate[]>([]);
  const [isChecking, startChecking] = useTransition();

  function patch(partial: Partial<BasicInfoFormState>) {
    onChange({ ...value, ...partial });
  }

  function handleNameBlur() {
    const trimmed = value.name.trim();
    if (trimmed.length === 0) {
      setDuplicates([]);
      return;
    }
    startChecking(async () => {
      const result = await checkDuplicateProductNameAction(trimmed, existingProductId);
      setDuplicates(result.ok ? (result.data ?? []) : []);
    });
  }

  const savePercent =
    value.priceRupees !== "" && value.compareAtPriceRupees !== ""
      ? discountPercent(value.priceRupees * 100, value.compareAtPriceRupees * 100)
      : null;

  const otherCategoryOptions = categoryOptions.filter(
    (option) => option.value !== value.primaryCategoryId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-name">Product name</Label>
        <Input
          id="product-name"
          value={value.name}
          onChange={(event) => patch({ name: event.target.value })}
          onBlur={handleNameBlur}
          required
          maxLength={300}
        />
        <p className="text-body-sm text-on-surface-variant">
          The full name customers will search for.
        </p>
        {isChecking && (
          <p className="text-body-sm text-on-surface-variant">Checking for similar products…</p>
        )}
        {!isChecking && duplicates.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-warning bg-warning/10 p-3 text-body-sm text-warning">
            {duplicates.map((candidate) => (
              <p key={candidate.id} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  You already have a product called &ldquo;{candidate.name}&rdquo;. Is this the same
                  one?{" "}
                  <Link href={`/admin/products/${candidate.id}/edit`} className="underline">
                    View it
                  </Link>
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-short-title">Short title</Label>
        <Input
          id="product-short-title"
          value={value.shortTitle}
          onChange={(event) => {
            setShortTitleTouched(true);
            patch({ shortTitle: event.target.value.slice(0, 70) });
          }}
          maxLength={70}
        />
        <div className="flex items-center justify-between">
          <p className="text-body-sm text-on-surface-variant">
            A shorter name for product cards. We&rsquo;ll shorten it for you.
          </p>
          <span className="text-label-mono-xs text-on-surface-variant">
            {value.shortTitle.length} / 70
          </span>
        </div>
        {!shortTitleTouched && !value.shortTitle && value.name && (
          <button
            type="button"
            onClick={() => patch({ shortTitle: value.name.slice(0, 70) })}
            className="self-start text-body-sm text-primary-container underline"
          >
            Use &ldquo;{value.name.slice(0, 70)}&rdquo;
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          value={value.description}
          onChange={(event) => patch({ description: event.target.value })}
          maxLength={4000}
          rows={4}
        />
        <p className="text-body-sm text-on-surface-variant">
          Shown on the product page. We&rsquo;ll write a short one for you if you leave this blank.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-brand">Brand</Label>
          <Combobox
            options={brandOptions}
            value={value.brandId}
            onChange={(brandId) => patch({ brandId })}
            placeholder="Choose a brand..."
            aria-label="Brand"
          />
          <p className="text-body-sm text-on-surface-variant">
            Don&rsquo;t see the brand?{" "}
            <Link href="/admin/brands" className="underline">
              Add it in Brands
            </Link>{" "}
            first, then come back here.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-category">Category</Label>
          <Combobox
            options={categoryOptions}
            value={value.primaryCategoryId}
            onChange={(primaryCategoryId) =>
              patch({
                primaryCategoryId,
                additionalCategoryIds: value.additionalCategoryIds.filter(
                  (id) => id !== primaryCategoryId,
                ),
              })
            }
            placeholder="Choose a category..."
            aria-label="Category"
          />
          <p className="text-body-sm text-on-surface-variant">
            Choose where this belongs on your website.
          </p>
        </div>
      </div>

      {otherCategoryOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-body-sm text-on-surface">Also show in</span>
          <p className="text-body-sm text-on-surface-variant">
            Other categories where this should appear.
          </p>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-glass-stroke p-3">
            {otherCategoryOptions.map((option) => {
              const checked = value.additionalCategoryIds.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-body-sm text-on-surface"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      patch({
                        additionalCategoryIds: next
                          ? [...value.additionalCategoryIds, option.value]
                          : value.additionalCategoryIds.filter((id) => id !== option.value),
                      })
                    }
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-price">Price</Label>
          <MoneyInput
            id="product-price"
            value={value.priceRupees}
            onChange={(priceRupees) => patch({ priceRupees })}
          />
          <p className="text-body-sm text-on-surface-variant">The normal price.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-offer-price">Offer price</Label>
          <MoneyInput
            id="product-offer-price"
            value={value.compareAtPriceRupees}
            onChange={(compareAtPriceRupees) => patch({ compareAtPriceRupees })}
          />
          <p className="text-body-sm text-on-surface-variant">
            The discounted price. Leave blank if there&rsquo;s no discount.
          </p>
          {savePercent !== null && savePercent > 0 && (
            <Badge variant="success" className="self-start">
              Save {savePercent}%
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-stock">Stock</Label>
          <Input
            id="product-stock"
            type="number"
            inputMode="numeric"
            min={0}
            value={value.stockQuantity}
            onChange={(event) =>
              patch({
                stockQuantity:
                  event.target.value === "" ? "" : Math.max(0, Number(event.target.value)),
              })
            }
          />
          <p className="text-body-sm text-on-surface-variant">How many you have right now.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-code">Product Code</Label>
          <Input
            id="product-code"
            value={value.productCode}
            onChange={(event) => patch({ productCode: event.target.value })}
            placeholder="Example: HP-VIC15-001"
            maxLength={40}
          />
          <p className="text-body-sm text-on-surface-variant">
            A short code you use to identify this product. We&rsquo;ll make one for you if you leave
            it blank.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-body-sm text-on-surface">Condition</span>
        <RadioGroup
          value={value.conditionType}
          onValueChange={(conditionType) =>
            patch({ conditionType: conditionType as ConditionType })
          }
          className="flex flex-wrap gap-4"
        >
          {CONDITION_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-body-sm text-on-surface"
            >
              <RadioGroupItem value={option.value} />
              {option.label}
            </label>
          ))}
        </RadioGroup>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-warranty-months">Warranty</Label>
          <Input
            id="product-warranty-months"
            type="number"
            inputMode="numeric"
            min={0}
            value={value.warrantyMonths}
            onChange={(event) =>
              patch({
                warrantyMonths:
                  event.target.value === "" ? "" : Math.max(0, Number(event.target.value)),
              })
            }
            placeholder="Months"
          />
          <p className="text-body-sm text-on-surface-variant">How many months of warranty?</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="product-warranty-text">Warranty details</Label>
          <Input
            id="product-warranty-text"
            value={value.warrantyText}
            onChange={(event) => patch({ warrantyText: event.target.value })}
            maxLength={200}
            placeholder="Optional — e.g. brought in for service"
          />
        </div>
      </div>
    </div>
  );
}
