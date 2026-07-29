"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Province } from "@/generated/prisma/client";
import { createBranchAction, updateBranchAction } from "../_actions";

const DAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface DayHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
}

export interface BranchFormValues {
  name: string;
  addressLine: string;
  district: string;
  province: Province;
  phone: string;
  email: string;
  isPickupEnabled: boolean;
  isDefaultFulfilment: boolean;
  isActive: boolean;
  hours: DayHours[];
}

export const EMPTY_BRANCH_FORM: BranchFormValues = {
  name: "",
  addressLine: "",
  district: "",
  province: Province.BAGMATI,
  phone: "",
  email: "",
  isPickupEnabled: true,
  isDefaultFulfilment: false,
  isActive: true,
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek === 6,
    openTime: "10:00",
    closeTime: "19:00",
  })),
};

export interface BranchFormProps {
  branchId?: string;
  initialValues: BranchFormValues;
}

/** Add/edit form for a store, including its weekly hours — docs/09 §3 ("Stores", OWNER only). */
export function BranchForm({ branchId, initialValues }: BranchFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<BranchFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateDay(dayOfWeek: number, patch: Partial<DayHours>) {
    setValues((prev) => ({
      ...prev,
      hours: prev.hours.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        addressLine: values.addressLine,
        district: values.district,
        province: values.province,
        phone: values.phone,
        email: values.email || undefined,
        isPickupEnabled: values.isPickupEnabled,
        isDefaultFulfilment: values.isDefaultFulfilment,
        isActive: values.isActive,
        hours: values.hours.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          isClosed: day.isClosed,
          openTime: day.isClosed ? undefined : day.openTime,
          closeTime: day.isClosed ? undefined : day.closeTime,
        })),
      };

      const result = branchId
        ? await updateBranchAction(branchId, payload)
        : await createBranchAction(payload);

      if (!result.ok) {
        toast(result.message ?? "Couldn't save this store. Please check the form.");
        return;
      }
      toast(branchId ? "Store saved." : "Store added.");
      router.push("/admin/branches");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch-name">Store name</Label>
        <Input
          id="branch-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branch-address">Street address</Label>
        <Input
          id="branch-address"
          value={values.addressLine}
          onChange={(e) => update("addressLine", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-district">District</Label>
          <Input
            id="branch-district"
            value={values.district}
            onChange={(e) => update("district", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-province">Province</Label>
          <Select value={values.province} onValueChange={(v) => update("province", v as Province)}>
            <SelectTrigger id="branch-province">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Province).map((province) => (
                <SelectItem key={province} value={province}>
                  {province}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-phone">Phone</Label>
          <Input
            id="branch-phone"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-email">Email</Label>
          <Input
            id="branch-email"
            type="email"
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-body-md text-on-surface">Opening hours</p>
        <div className="flex flex-col gap-2 rounded-xl border border-glass-stroke p-4">
          {values.hours.map((day) => (
            <div key={day.dayOfWeek} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-body-sm text-on-surface-variant">
                {DAY_LABEL[day.dayOfWeek]}
              </span>
              <Switch
                checked={!day.isClosed}
                onCheckedChange={(open) => updateDay(day.dayOfWeek, { isClosed: !open })}
                aria-label={`Open on ${DAY_LABEL[day.dayOfWeek]}`}
              />
              {day.isClosed ? (
                <span className="text-body-sm text-on-surface-variant">Closed</span>
              ) : (
                <>
                  <Input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                    className="w-32"
                    aria-label={`${DAY_LABEL[day.dayOfWeek]} opening time`}
                  />
                  <span className="text-body-sm text-on-surface-variant">to</span>
                  <Input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => updateDay(day.dayOfWeek, { closeTime: e.target.value })}
                    className="w-32"
                    aria-label={`${DAY_LABEL[day.dayOfWeek]} closing time`}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Customers can pick up orders here</p>
        </div>
        <Switch
          checked={values.isPickupEnabled}
          onCheckedChange={(v) => update("isPickupEnabled", v)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Default store for delivery orders</p>
          <p className="text-body-sm text-on-surface-variant">
            Orders are shipped from here unless a customer picks another store.
          </p>
        </div>
        <Switch
          checked={values.isDefaultFulfilment}
          onCheckedChange={(v) => update("isDefaultFulfilment", v)}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Live</p>
          <p className="text-body-sm text-on-surface-variant">
            Turn off to hide this store without deleting it.
          </p>
        </div>
        <Switch checked={values.isActive} onCheckedChange={(v) => update("isActive", v)} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/branches")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : branchId ? "Save changes" : "Add store"}
        </Button>
      </div>
    </form>
  );
}
