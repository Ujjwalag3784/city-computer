"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NEPAL_PROVINCES } from "@/lib/nepal";

/**
 * The Nepal address form fields shared by the checkout page's shipping and
 * (optional, when `billingSameAsShipping` is unchecked) billing address
 * sub-forms — `district`/`municipality`/`ward` are plain free text/number
 * fields per `lib/validation/checkout.ts`'s `checkoutAddressSchema`, since
 * no exhaustive Nepal district/municipality list exists anywhere in this
 * codebase yet (`DeliveryZone.districts` itself is matched case-
 * insensitively against whatever a shopper types here).
 */
export interface AddressFormValue {
  fullName: string;
  phone: string;
  alternatePhone: string;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  streetAddress: string;
  landmark: string;
}

export const EMPTY_ADDRESS: AddressFormValue = {
  fullName: "",
  phone: "",
  alternatePhone: "",
  province: "",
  district: "",
  municipality: "",
  ward: "",
  streetAddress: "",
  landmark: "",
};

export interface AddressFieldsProps {
  idPrefix: string;
  value: AddressFormValue;
  onChange: (patch: Partial<AddressFormValue>) => void;
  errors?: Partial<Record<keyof AddressFormValue, string>>;
}

const PROVINCE_LABELS: Record<(typeof NEPAL_PROVINCES)[number], string> = {
  KOSHI: "Koshi",
  MADHESH: "Madhesh",
  BAGMATI: "Bagmati",
  GANDAKI: "Gandaki",
  LUMBINI: "Lumbini",
  KARNALI: "Karnali",
  SUDURPASHCHIM: "Sudurpashchim",
};

function fieldId(prefix: string, name: string): string {
  return `${prefix}-${name}`;
}

export function AddressFields({ idPrefix, value, onChange, errors = {} }: AddressFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={fieldId(idPrefix, "fullName")}>Full name</Label>
        <Input
          id={fieldId(idPrefix, "fullName")}
          value={value.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          error={Boolean(errors.fullName)}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? fieldId(idPrefix, "fullName-error") : undefined}
        />
        {errors.fullName && (
          <p
            id={fieldId(idPrefix, "fullName-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "phone")}>Mobile number</Label>
        <Input
          id={fieldId(idPrefix, "phone")}
          type="tel"
          placeholder="98XXXXXXXX"
          value={value.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          error={Boolean(errors.phone)}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? fieldId(idPrefix, "phone-error") : undefined}
        />
        {errors.phone && (
          <p id={fieldId(idPrefix, "phone-error")} role="alert" className="text-body-sm text-error">
            {errors.phone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "alternatePhone")}>Alternate number (optional)</Label>
        <Input
          id={fieldId(idPrefix, "alternatePhone")}
          type="tel"
          placeholder="98XXXXXXXX"
          value={value.alternatePhone}
          onChange={(event) => onChange({ alternatePhone: event.target.value })}
          error={Boolean(errors.alternatePhone)}
          aria-invalid={Boolean(errors.alternatePhone)}
          aria-describedby={
            errors.alternatePhone ? fieldId(idPrefix, "alternatePhone-error") : undefined
          }
        />
        {errors.alternatePhone && (
          <p
            id={fieldId(idPrefix, "alternatePhone-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.alternatePhone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "province")}>Province</Label>
        <Select value={value.province} onValueChange={(province) => onChange({ province })}>
          <SelectTrigger
            id={fieldId(idPrefix, "province")}
            aria-invalid={Boolean(errors.province)}
            aria-describedby={errors.province ? fieldId(idPrefix, "province-error") : undefined}
          >
            <SelectValue placeholder="Select province" />
          </SelectTrigger>
          <SelectContent>
            {NEPAL_PROVINCES.map((province) => (
              <SelectItem key={province} value={province}>
                {/* eslint-disable-next-line security/detect-object-injection -- `province` is narrowed to the closed `NEPAL_PROVINCES` union, never arbitrary input. */}
                {PROVINCE_LABELS[province]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.province && (
          <p
            id={fieldId(idPrefix, "province-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.province}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "district")}>District</Label>
        <Input
          id={fieldId(idPrefix, "district")}
          value={value.district}
          onChange={(event) => onChange({ district: event.target.value })}
          error={Boolean(errors.district)}
          aria-invalid={Boolean(errors.district)}
          aria-describedby={errors.district ? fieldId(idPrefix, "district-error") : undefined}
        />
        {errors.district && (
          <p
            id={fieldId(idPrefix, "district-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.district}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "municipality")}>Municipality / city</Label>
        <Input
          id={fieldId(idPrefix, "municipality")}
          value={value.municipality}
          onChange={(event) => onChange({ municipality: event.target.value })}
          error={Boolean(errors.municipality)}
          aria-invalid={Boolean(errors.municipality)}
          aria-describedby={
            errors.municipality ? fieldId(idPrefix, "municipality-error") : undefined
          }
        />
        {errors.municipality && (
          <p
            id={fieldId(idPrefix, "municipality-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.municipality}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId(idPrefix, "ward")}>Ward (optional)</Label>
        <Input
          id={fieldId(idPrefix, "ward")}
          type="number"
          min={1}
          max={35}
          value={value.ward}
          onChange={(event) => onChange({ ward: event.target.value })}
          error={Boolean(errors.ward)}
          aria-invalid={Boolean(errors.ward)}
          aria-describedby={errors.ward ? fieldId(idPrefix, "ward-error") : undefined}
        />
        {errors.ward && (
          <p id={fieldId(idPrefix, "ward-error")} role="alert" className="text-body-sm text-error">
            {errors.ward}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={fieldId(idPrefix, "streetAddress")}>Street address</Label>
        <Input
          id={fieldId(idPrefix, "streetAddress")}
          value={value.streetAddress}
          onChange={(event) => onChange({ streetAddress: event.target.value })}
          error={Boolean(errors.streetAddress)}
          aria-invalid={Boolean(errors.streetAddress)}
          aria-describedby={
            errors.streetAddress ? fieldId(idPrefix, "streetAddress-error") : undefined
          }
        />
        {errors.streetAddress && (
          <p
            id={fieldId(idPrefix, "streetAddress-error")}
            role="alert"
            className="text-body-sm text-error"
          >
            {errors.streetAddress}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor={fieldId(idPrefix, "landmark")}>Landmark (optional)</Label>
        <Input
          id={fieldId(idPrefix, "landmark")}
          value={value.landmark}
          onChange={(event) => onChange({ landmark: event.target.value })}
        />
      </div>
    </div>
  );
}
