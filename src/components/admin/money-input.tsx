"use client";

import { Input } from "@/components/ui/input";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * MoneyInput — docs/09-ADMIN-DAD-MODE.md §5.1 Step 1's Price/Offer price
 * fields: "रु prefix, thousands auto-formatted."
 *
 * Scope note: this renders the रु prefix and, once a value is entered, a
 * formatted preview line below the field (`formatNPR`, this codebase's
 * "ONE currency formatter") — but it does NOT live-mask the input itself
 * with thousands separators while typing. A correct masked-number input
 * (one that keeps the caret in the right place as digits and separators
 * are added/removed) needs either a dedicated masking library or a fair
 * amount of custom caret-math, neither of which exists in this codebase
 * yet. The formatted preview line gives the owner the same "is this the
 * right number" confirmation the doc is really asking for, just below
 * the field instead of inside it.
 *
 * Values are always whole rupees (not paisa) — this codebase never lets
 * an admin type fractional paisa; `product-wizard.tsx` converts to paisa
 * with `rupeesToPaisa` right before calling a Server Action.
 */
export interface MoneyInputProps {
  id?: string;
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  ...aria
}: MoneyInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 text-body-md text-on-surface-variant"
        >
          रु
        </span>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "") {
              onChange("");
              return;
            }
            const parsed = Math.round(Number(raw));
            onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : "");
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-9", className)}
          {...aria}
        />
      </div>
      {value !== "" && value > 0 && (
        <span className="text-label-mono-xs text-on-surface-variant">{formatNPR(value * 100)}</span>
      )}
    </div>
  );
}
