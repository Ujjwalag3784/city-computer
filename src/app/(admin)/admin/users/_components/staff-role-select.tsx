"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// All three come from `lib/**` on purpose: this is a Client Component, and
// `@/server/services/admin/staff` (where `STAFF_ROLE_DESCRIPTIONS` used to
// be read from) is `server-only`.
import {
  STAFF_ROLE_DESCRIPTIONS,
  STAFF_ROLE_KEYS,
  type StaffRoleKey,
} from "@/lib/validation/admin/staff";
import { updateStaffRoleAction } from "../_actions";

export function StaffRoleSelect({ userId, roleKey }: { userId: string; roleKey: StaffRoleKey }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(next: string) {
    setPending(true);
    try {
      const result = await updateStaffRoleAction({ userId, roleKey: next });
      if (!result.ok) {
        toast(result.message ?? "Couldn't change this role.");
        return;
      }
      toast("Role updated.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={roleKey} onValueChange={(v) => void handleChange(v)} disabled={pending}>
      <SelectTrigger aria-label="Role" className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAFF_ROLE_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {/* eslint-disable-next-line security/detect-object-injection -- `key` is drawn from `STAFF_ROLE_KEYS` itself, never arbitrary input. */}
            {STAFF_ROLE_DESCRIPTIONS[key].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
