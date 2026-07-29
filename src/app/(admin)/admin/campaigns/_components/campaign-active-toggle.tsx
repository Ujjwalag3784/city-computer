"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setCampaignActiveAction } from "../_actions";

export function CampaignActiveToggle({
  campaignId,
  isActive,
}: {
  campaignId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: boolean) {
    setPending(true);
    try {
      const result = await setCampaignActiveAction({ campaignId, isActive: next });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this campaign.");
        return;
      }
      toast(next ? "Campaign turned on." : "Campaign turned off.");
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
      aria-label={isActive ? "Turn off this campaign" : "Turn on this campaign"}
    />
  );
}
