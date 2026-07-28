"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSpecFieldOption } from "@/server/services/admin/product";
import type { ProductSpecRow } from "../_lib/wizard-types";

/**
 * Step 3 — "Details (specifications)" (docs/09-ADMIN-DAD-MODE.md §5.1):
 * "The category chosen in step 1 loads the right template automatically.
 * The owner never designs a spec sheet." Template fields (`templateFields`,
 * loaded by `product-wizard.tsx` from `getSpecTemplateFieldsAction` when
 * the category changes) render first, each with its own input type
 * (`TEXT`/`NUMBER`/`BOOL`/`SELECT`); anything the owner adds via
 * "+ Add another detail" renders below as a free-form label/value pair.
 *
 * A row is "template-driven" if its `key` matches one of `templateFields`;
 * everything else in `specs` is free-form. This is computed here, not
 * stored as a flag on the row, so the two lists can never drift out of
 * sync with whatever `templateFields` currently is (e.g. after the owner
 * changes category back on Step 1 and comes back to Step 3).
 *
 * When `templateFields` is empty (docs/06/09 gap documented in
 * `server/services/admin/product.ts`'s `getSpecTemplateFields`: a
 * category created via `/admin/categories` has no template yet), this
 * renders *only* the free-form section and its "+ Add another detail"
 * button — never a dead "no fields" empty state, since there's always
 * still something useful to do here.
 */
export interface DetailsStepProps {
  templateFields: AdminSpecFieldOption[];
  specs: ProductSpecRow[];
  onSpecsChange: (specs: ProductSpecRow[]) => void;
}

function findRow(specs: ProductSpecRow[], key: string): ProductSpecRow | undefined {
  return specs.find((row) => row.key === key);
}

function upsertRow(
  specs: ProductSpecRow[],
  key: string,
  patch: Partial<ProductSpecRow>,
  template?: AdminSpecFieldOption,
) {
  const existing = findRow(specs, key);
  if (existing) {
    return specs.map((row) => (row.key === key ? { ...row, ...patch } : row));
  }
  return [
    ...specs,
    {
      key,
      label: template?.label ?? key,
      unit: template?.unit ?? undefined,
      group: template?.group ?? undefined,
      ...patch,
    },
  ];
}

export function DetailsStep({ templateFields, specs, onSpecsChange }: DetailsStepProps) {
  const templateKeys = new Set(templateFields.map((field) => field.key));
  const freeformRows = specs.filter((row) => !templateKeys.has(row.key));

  function addFreeformRow() {
    const key = `custom-${crypto.randomUUID()}`;
    onSpecsChange([...specs, { key, label: "" }]);
  }

  function updateFreeformRow(key: string, patch: Partial<ProductSpecRow>) {
    onSpecsChange(specs.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    onSpecsChange(specs.filter((row) => row.key !== key));
  }

  return (
    <div className="flex flex-col gap-6">
      {templateFields.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2">
          {templateFields.map((field) => {
            const row = findRow(specs, field.key);
            const inputId = `spec-${field.key}`;
            return (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={inputId}>
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                </Label>

                {field.dataType === "BOOL" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={inputId}
                      checked={row?.valueBool ?? false}
                      onCheckedChange={(checked) =>
                        onSpecsChange(upsertRow(specs, field.key, { valueBool: checked }, field))
                      }
                    />
                  </div>
                ) : field.dataType === "SELECT" && field.options.length > 0 ? (
                  <Select
                    value={row?.valueText ?? ""}
                    onValueChange={(valueText) =>
                      onSpecsChange(upsertRow(specs, field.key, { valueText }, field))
                    }
                  >
                    <SelectTrigger id={inputId}>
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.dataType === "NUMBER" ? (
                  <Input
                    id={inputId}
                    type="number"
                    value={row?.valueNumber ?? ""}
                    onChange={(event) =>
                      onSpecsChange(
                        upsertRow(
                          specs,
                          field.key,
                          {
                            valueNumber:
                              event.target.value === "" ? undefined : Number(event.target.value),
                          },
                          field,
                        ),
                      )
                    }
                  />
                ) : (
                  <Input
                    id={inputId}
                    value={row?.valueText ?? ""}
                    onChange={(event) =>
                      onSpecsChange(
                        upsertRow(specs, field.key, { valueText: event.target.value }, field),
                      )
                    }
                  />
                )}

                {field.helpText && (
                  <p className="text-body-sm text-on-surface-variant">{field.helpText}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {freeformRows.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-body-sm text-on-surface">Other details</span>
            {freeformRows.map((row) => (
              <div key={row.key} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor={`${row.key}-label`}>Detail name</Label>
                  <Input
                    id={`${row.key}-label`}
                    value={row.label}
                    onChange={(event) => updateFreeformRow(row.key, { label: event.target.value })}
                    placeholder="e.g. Colour"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor={`${row.key}-value`}>Value</Label>
                  <Input
                    id={`${row.key}-value`}
                    value={row.valueText ?? ""}
                    onChange={(event) =>
                      updateFreeformRow(row.key, { valueText: event.target.value })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  iconOnly
                  aria-label="Remove this detail"
                  onClick={() => removeRow(row.key)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="outline" onClick={addFreeformRow} className="self-start">
          <Plus />
          Add another detail
        </Button>
      </div>
    </div>
  );
}
