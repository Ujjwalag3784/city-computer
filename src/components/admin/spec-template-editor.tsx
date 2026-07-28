"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SpecTemplateEditor — docs/06-DATA-MODEL.md's `SpecTemplate`/`SpecField`
 * model ("Per-category templates that make the admin's Step 3 automatic")
 * and docs/09-ADMIN-DAD-MODE.md §5.1 Step 3 ("Details (specifications)"):
 * "The category chosen in step 1 loads the right template automatically.
 * The owner never designs a spec sheet."
 *
 * That quote is exactly why this component exists as a *separate*, almost
 * certainly TECHNICIAN/OWNER-only screen: someone still has to define the
 * ~15 seeded templates (Laptop, Desktop/Prebuilt, Monitor, CPU, GPU,
 * Motherboard, RAM, Storage, PSU, Cooler, Case, Printer, Projector, CCTV,
 * Accessory — docs/06) that Step 3 then loads automatically for the shop
 * owner. This is that authoring surface — which fields exist, in what
 * order, what type — NOT the product-facing form where someone fills in
 * "16GB RAM" for one specific laptop (a different, simpler screen, out of
 * scope here).
 *
 * `"use client"`: every row wires `onChange`/`onClick` handlers directly
 * onto `Input`/`Select`/`Switch`/`Button` elements in this file's own
 * render tree (the same reasoning `builder/issue-row.tsx` documents).
 *
 * Reorder mechanism: per `image-dropzone.tsx`'s own precedent in this
 * folder, a real pointer-event drag-and-drop implementation is a lot of
 * surface to get correctly right in one pass, so this ships small up/down
 * arrow buttons (`ArrowUp`/`ArrowDown`) instead of a `GripVertical` drag
 * handle — they call `onFieldsChange` with the array swapped, are fully
 * keyboard-operable, and never look draggable without actually being
 * draggable.
 *
 * ID generation: `src/lib/ids.ts` only generates permanent, human-safe
 * *domain* identifiers (build short IDs, order/ticket numbers) validated
 * against specific formats — none of that fits a throwaway client-side key
 * for a not-yet-persisted field row, so new fields get a plain
 * `crypto.randomUUID()` instead of inventing a third ID scheme; the real
 * persisted `id` is assigned server-side once the field is saved.
 *
 * Every change (label edit, type change, options edit, required toggle,
 * reorder, add, remove) calls `onFieldsChange` with the complete updated
 * array — this component holds no field state of its own beyond the
 * controlled inputs below; the caller owns `fields`.
 */
export interface SpecTemplateField {
  id: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  /** Only relevant when `type === "select"`. */
  options?: string[];
  required: boolean;
}

export interface SpecTemplateEditorProps {
  categoryName: string;
  fields: SpecTemplateField[];
  onFieldsChange: (fields: SpecTemplateField[]) => void;
  className?: string;
}

const FIELD_TYPE_LABEL: Record<SpecTemplateField["type"], string> = {
  text: "Text",
  number: "Number",
  select: "Select (dropdown)",
  boolean: "Yes / No",
};

function createBlankField(): SpecTemplateField {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "text",
    required: false,
  };
}

export function SpecTemplateEditor({
  categoryName,
  fields,
  onFieldsChange,
  className,
}: SpecTemplateEditorProps) {
  function updateField(id: string, patch: Partial<SpecTemplateField>) {
    onFieldsChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
  }

  function removeField(id: string) {
    onFieldsChange(fields.filter((field) => field.id !== id));
  }

  function moveField(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const next = [...fields];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    onFieldsChange(next);
  }

  function addField() {
    onFieldsChange([...fields, createBlankField()]);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <h2 className="text-title text-on-surface">Spec template for {categoryName}</h2>

      <div className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="flex flex-col gap-3 rounded-xl border border-glass-stroke bg-surface-container p-4 sm:flex-row sm:items-start"
          >
            <div className="flex flex-col gap-1 pt-2 sm:pt-0">
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Move ${field.label || "field"} up`}
                disabled={index === 0}
                onClick={() => moveField(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Move ${field.label || "field"} down`}
                disabled={index === fields.length - 1}
                onClick={() => moveField(index, 1)}
              >
                <ArrowDown />
              </Button>
            </div>

            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`field-label-${field.id}`}
                  className="text-body-lg text-on-surface-variant"
                >
                  Field label
                </label>
                <Input
                  id={`field-label-${field.id}`}
                  value={field.label}
                  placeholder="e.g. Processor"
                  onChange={(event) => updateField(field.id, { label: event.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`field-type-${field.id}`}
                  className="text-body-lg text-on-surface-variant"
                >
                  Field type
                </label>
                <Select
                  value={field.type}
                  onValueChange={(value) =>
                    updateField(field.id, { type: value as SpecTemplateField["type"] })
                  }
                >
                  <SelectTrigger id={`field-type-${field.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {field.type === "select" && (
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label
                    htmlFor={`field-options-${field.id}`}
                    className="text-body-lg text-on-surface-variant"
                  >
                    Options (comma-separated)
                  </label>
                  <Input
                    id={`field-options-${field.id}`}
                    value={field.options?.join(", ") ?? ""}
                    placeholder="e.g. 8GB, 16GB, 32GB"
                    onChange={(event) => {
                      const options = event.target.value
                        .split(",")
                        .map((option) => option.trim())
                        .filter((option) => option.length > 0);
                      updateField(field.id, { options });
                    }}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  id={`field-required-${field.id}`}
                  checked={field.required}
                  onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                />
                <label
                  htmlFor={`field-required-${field.id}`}
                  className="text-body-lg text-on-surface"
                >
                  Required
                </label>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              iconOnly
              aria-label={`Remove ${field.label || "field"}`}
              onClick={() => removeField(field.id)}
              className="self-start text-danger hover:text-danger"
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addField} className="self-start">
        <Plus />
        Add field
      </Button>
    </div>
  );
}
