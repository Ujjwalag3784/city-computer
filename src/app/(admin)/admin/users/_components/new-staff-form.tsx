"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STAFF_ROLE_KEYS, type StaffRoleKey } from "@/lib/validation/admin/staff";
import { createStaffAction } from "../_actions";

export interface StaffRoleDescription {
  key: StaffRoleKey;
  label: string;
  description: string;
}

export function NewStaffForm({ roles }: { roles: StaffRoleDescription[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleKey, setRoleKey] = useState<StaffRoleKey>("STAFF");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ name: string; temporaryPassword: string } | null>(null);

  const selectedRole = roles.find((r) => r.key === roleKey);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await createStaffAction({
        name,
        email: email || undefined,
        phone: phone || undefined,
        roleKey,
      });
      if (!result.ok) {
        toast(result.message ?? "Couldn't add this staff member. Please check the form.");
        return;
      }
      setCreated({ name, temporaryPassword: result.data?.temporaryPassword ?? "" });
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <p className="text-body-md text-on-surface">
            <span className="font-medium">{created.name}</span> has been added.
          </p>
          <p className="text-body-sm text-on-surface-variant">
            Give them this temporary password so they can sign in. It won&apos;t be shown again —
            they should change it after their first sign-in.
          </p>
          <p className="rounded-lg border border-glass-stroke bg-surface-container px-4 py-3 font-mono text-body-lg text-on-surface">
            {created.temporaryPassword}
          </p>
          <Button type="button" onClick={() => router.push("/admin/users")}>
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-name">Name</Label>
        <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="staff-phone">Phone</Label>
          <Input id="staff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <p className="text-body-sm text-on-surface-variant">
        Enter at least a phone number or an email address.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="staff-role">Role</Label>
        <Select value={roleKey} onValueChange={(v) => setRoleKey(v as StaffRoleKey)}>
          <SelectTrigger id="staff-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAFF_ROLE_KEYS.map((key) => {
              const role = roles.find((r) => r.key === key);
              return (
                <SelectItem key={key} value={key}>
                  {role?.label ?? key}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selectedRole && (
          <p className="text-body-sm text-on-surface-variant">{selectedRole.description}</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/users")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add staff member"}
        </Button>
      </div>
    </form>
  );
}
