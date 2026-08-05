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
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { PromotionType } from "@/generated/prisma/enums";
import { createCampaignAction, updateCampaignAction } from "../_actions";

export interface CampaignFormValues {
  name: string;
  type: PromotionType;
  priority: number;
  stackable: boolean;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export const EMPTY_CAMPAIGN_FORM: CampaignFormValues = {
  name: "",
  type: PromotionType.PERCENTAGE,
  priority: 0,
  stackable: false,
  startsAt: "",
  endsAt: "",
  isActive: true,
};

export interface CampaignFormProps {
  campaignId?: string;
  initialValues: CampaignFormValues;
}

/**
 * Add/edit form for a campaign's own metadata — see `admin/campaigns.ts`'s
 * doc comment for why its `PromotionRule` targeting isn't editable here
 * this pass.
 */
export function CampaignForm({ campaignId, initialValues }: CampaignFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<CampaignFormValues>(initialValues);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof CampaignFormValues>(key: K, value: CampaignFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        type: values.type,
        priority: values.priority,
        stackable: values.stackable,
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
        isActive: values.isActive,
      };
      const result = campaignId
        ? await updateCampaignAction(campaignId, payload)
        : await createCampaignAction(payload);

      if (!result.ok) {
        toast(result.message ?? "Couldn't save this campaign. Please check the form.");
        return;
      }
      toast(campaignId ? "Campaign saved." : "Campaign created.");
      router.push("/admin/campaigns");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-name">Campaign name</Label>
        <Input
          id="campaign-name"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="e.g. Dashain headphones sale"
          required
        />
        <p className="text-body-sm text-on-surface-variant">
          Shown to your team only, not to customers.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-type">Type</Label>
        <Select value={values.type} onValueChange={(v) => update("type", v as PromotionType)}>
          <SelectTrigger id="campaign-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PromotionType.PERCENTAGE}>Percentage off</SelectItem>
            <SelectItem value={PromotionType.FIXED}>Fixed amount off</SelectItem>
            <SelectItem value={PromotionType.BUY_X_GET_Y}>Buy X, get Y</SelectItem>
            <SelectItem value={PromotionType.BUNDLE}>Bundle</SelectItem>
            <SelectItem value={PromotionType.TIERED}>Tiered</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-body-sm text-on-surface-variant">
          Which products this discounts and by how much still needs a developer to set up — ask them
          once you&rsquo;ve saved this campaign.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="campaign-priority">Priority</Label>
        <Input
          id="campaign-priority"
          type="number"
          min={0}
          max={100}
          value={values.priority}
          onChange={(e) => update("priority", Number(e.target.value))}
        />
        <p className="text-body-sm text-on-surface-variant">
          When two campaigns could both apply, the higher number wins.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-starts-at">Starts</Label>
          <Input
            id="campaign-starts-at"
            type="date"
            value={values.startsAt}
            onChange={(e) => update("startsAt", e.target.value)}
          />
          <p className="text-body-sm text-on-surface-variant">Leave blank to start right away.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="campaign-ends-at">Ends</Label>
          <Input
            id="campaign-ends-at"
            type="date"
            value={values.endsAt}
            onChange={(e) => update("endsAt", e.target.value)}
          />
          <p className="text-body-sm text-on-surface-variant">
            Leave blank to run until you turn it off.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Can combine with other offers</p>
          <p className="text-body-sm text-on-surface-variant">
            Let this stack with other active campaigns.
          </p>
        </div>
        <Switch checked={values.stackable} onCheckedChange={(v) => update("stackable", v)} />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">Live</p>
          <p className="text-body-sm text-on-surface-variant">
            Turn off to pause this campaign without deleting it.
          </p>
        </div>
        <Switch checked={values.isActive} onCheckedChange={(v) => update("isActive", v)} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/campaigns")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : campaignId ? "Save changes" : "Create campaign"}
        </Button>
      </div>
    </form>
  );
}
