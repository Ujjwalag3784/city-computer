"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setCouponActiveAction } from "../_actions";

export function CouponActiveToggle({
  couponId,
  isActive,
}: {
  couponId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: boolean) {
    setPending(true);
    try {
      const result = await setCouponActiveAction({ couponId, isActive: next });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this discount code.");
        return;
      }
      toast(next ? "Discount code turned on." : "Discount code turned off.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Switch
      checked={isActive}
      disabled={pending}
      onCheckedChange={(next) => void handleChange(next)}
      aria-label={isActive ? "Turn off this discount code" : "Turn on this discount code"}
    />
  );
}
