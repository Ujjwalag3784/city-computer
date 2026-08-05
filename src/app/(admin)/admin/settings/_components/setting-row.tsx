"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { SettingDataType } from "@/generated/prisma/enums";
import { updateSettingAction } from "../_actions";

export interface SettingRowProps {
  settingKey: string;
  label: string;
  helpText: string | null;
  dataType: SettingDataType;
  value: unknown;
}

function toRawValue(dataType: SettingDataType, value: unknown): string {
  if (dataType === SettingDataType.JSON) return JSON.stringify(value, null, 2);
  return String(value ?? "");
}

export function SettingRow({ settingKey, label, helpText, dataType, value }: SettingRowProps) {
  const router = useRouter();
  const [raw, setRaw] = useState(() => toRawValue(dataType, value));
  const [boolValue, setBoolValue] = useState(() => value === true);
  const [saving, setSaving] = useState(false);

  async function save(rawValue: string) {
    setSaving(true);
    try {
      const result = await updateSettingAction({ key: settingKey, rawValue });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save this setting.");
        return;
      }
      toast("Saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-glass-stroke p-4">
      <p className="text-body-md font-medium text-on-surface">{label}</p>
      {helpText && <p className="text-body-sm text-on-surface-variant">{helpText}</p>}

      {dataType === SettingDataType.BOOLEAN ? (
        <Switch
          checked={boolValue}
          disabled={saving}
          onCheckedChange={(next) => {
            setBoolValue(next);
            void save(String(next));
          }}
          aria-label={label}
        />
      ) : dataType === SettingDataType.JSON ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-end"
            disabled={saving}
            onClick={() => void save(raw)}
          >
            Save
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type={dataType === SettingDataType.NUMBER ? "number" : "text"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="max-w-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void save(raw)}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
