"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setStaffStatusAction } from "../_actions";

export function StaffStatusToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: boolean) {
    setPending(true);
    try {
      const result = await setStaffStatusAction({ userId, isActive: next });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this account.");
        return;
      }
      toast(next ? "Account turned back on." : "Account turned off — they can no longer sign in.");
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
      aria-label={isActive ? "Turn off this account" : "Turn on this account"}
    />
  );
}
