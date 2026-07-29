"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { paisaToRupees } from "@/lib/money";
import { updateShippingRateAction } from "../_actions";
import type { AdminShippingZone } from "@/server/services/admin/settings";

export function ShippingRateRow({ zone }: { zone: AdminShippingZone }) {
  const router = useRouter();
  const rate = zone.rates[0];
  const [price, setPrice] = useState(rate ? String(paisaToRupees(rate.basePricePaisa)) : "0");
  const [daysMin, setDaysMin] = useState(String(zone.estimatedDaysMin));
  const [daysMax, setDaysMax] = useState(String(zone.estimatedDaysMax));
  const [saving, setSaving] = useState(false);

  if (!rate) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateShippingRateAction({
        rateId: rate!.id,
        basePriceRupees: Number(price),
        estimatedDaysMin: Number(daysMin),
        estimatedDaysMax: Number(daysMax),
      });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save this delivery zone.");
        return;
      }
      toast("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-glass-stroke p-4">
      <p className="text-body-md font-medium text-on-surface">{zone.name}</p>
      <p className="text-body-sm text-on-surface-variant">{zone.districts.join(", ")}</p>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rate-price-${rate.id}`}>Delivery price (रु)</Label>
          <Input
            id={`rate-price-${rate.id}`}
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rate-days-min-${rate.id}`}>Fastest (days)</Label>
          <Input
            id={`rate-days-min-${rate.id}`}
            type="number"
            min={0}
            value={daysMin}
            onChange={(e) => setDaysMin(e.target.value)}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rate-days-max-${rate.id}`}>Slowest (days)</Label>
          <Input
            id={`rate-days-max-${rate.id}`}
            type="number"
            min={0}
            value={daysMax}
            onChange={(e) => setDaysMax(e.target.value)}
            className="w-24"
          />
        </div>
        <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSave()}>
          Save
        </Button>
      </div>
    </div>
  );
}
