"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServiceDeviceType, TicketPriority } from "@/generated/prisma/client";
import { createTicketAction } from "../_actions";

export interface NewTicketFormProps {
  branches: { id: string; name: string }[];
}

const DEVICE_TYPE_LABEL: Record<ServiceDeviceType, string> = {
  [ServiceDeviceType.LAPTOP]: "Laptop",
  [ServiceDeviceType.DESKTOP]: "Desktop",
  [ServiceDeviceType.MONITOR]: "Monitor",
  [ServiceDeviceType.PRINTER]: "Printer",
  [ServiceDeviceType.OTHER]: "Other",
};

export function NewTicketForm({ branches }: NewTicketFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    name: "",
    phone: "",
    email: "",
    branchId: branches[0]?.id ?? "",
    deviceType: ServiceDeviceType.LAPTOP as ServiceDeviceType,
    brand: "",
    model: "",
    serialNumber: "",
    issueCategory: "",
    issueDescription: "",
    accessoriesText: "",
    priority: TicketPriority.NORMAL as TicketPriority,
    warrantyClaim: false,
  });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues({});
    try {
      const result = await createTicketAction({
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        branchId: values.branchId,
        deviceType: values.deviceType,
        brand: values.brand,
        model: values.model || undefined,
        serialNumber: values.serialNumber || undefined,
        issueCategory: values.issueCategory,
        issueDescription: values.issueDescription,
        accessoriesReceived: values.accessoriesText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        priority: values.priority,
        warrantyClaim: values.warrantyClaim,
      });

      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        toast(result.message ?? "Couldn't create this repair job. Please check the form.");
        return;
      }

      toast(`Repair job ${result.data?.ticketNumber} created.`);
      router.push(`/admin/service/${result.data?.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-name">Customer name</Label>
          <Input
            id="ticket-name"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
          {issues.name && <p className="text-body-sm text-danger">{issues.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-phone">Phone</Label>
          <Input
            id="ticket-phone"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
          {issues.phone && <p className="text-body-sm text-danger">{issues.phone}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-email">Email</Label>
        <Input
          id="ticket-email"
          type="email"
          value={values.email}
          onChange={(e) => update("email", e.target.value)}
        />
        <p className="text-body-sm text-on-surface-variant">
          Optional — used to send status updates if you set that up later.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-branch">Which branch is receiving this device?</Label>
        <Select value={values.branchId} onValueChange={(v) => update("branchId", v)}>
          <SelectTrigger id="ticket-branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-device-type">Device type</Label>
          <Select
            value={values.deviceType}
            onValueChange={(v) => update("deviceType", v as ServiceDeviceType)}
          >
            <SelectTrigger id="ticket-device-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ServiceDeviceType).map((type) => (
                <SelectItem key={type} value={type}>
                  {/* eslint-disable-next-line security/detect-object-injection -- `type` is drawn from `Object.values(ServiceDeviceType)`, never arbitrary input. */}
                  {DEVICE_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select
            value={values.priority}
            onValueChange={(v) => update("priority", v as TicketPriority)}
          >
            <SelectTrigger id="ticket-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TicketPriority.LOW}>Low</SelectItem>
              <SelectItem value={TicketPriority.NORMAL}>Normal</SelectItem>
              <SelectItem value={TicketPriority.HIGH}>High</SelectItem>
              <SelectItem value={TicketPriority.URGENT}>Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-brand">Brand</Label>
          <Input
            id="ticket-brand"
            value={values.brand}
            onChange={(e) => update("brand", e.target.value)}
            placeholder="e.g. HP"
            required
          />
          {issues.brand && <p className="text-body-sm text-danger">{issues.brand}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-model">Model</Label>
          <Input
            id="ticket-model"
            value={values.model}
            onChange={(e) => update("model", e.target.value)}
            placeholder="e.g. Victus 15"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-serial">Serial number</Label>
        <Input
          id="ticket-serial"
          value={values.serialNumber}
          onChange={(e) => update("serialNumber", e.target.value)}
        />
        <p className="text-body-sm text-on-surface-variant">
          Optional, but helps if there&apos;s a warranty question later.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-issue-category">Type of problem</Label>
        <Input
          id="ticket-issue-category"
          value={values.issueCategory}
          onChange={(e) => update("issueCategory", e.target.value)}
          placeholder="e.g. Won't turn on"
          required
        />
        {issues.issueCategory && <p className="text-body-sm text-danger">{issues.issueCategory}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-issue-description">Describe the problem</Label>
        <Textarea
          id="ticket-issue-description"
          value={values.issueDescription}
          onChange={(e) => update("issueDescription", e.target.value)}
          rows={3}
          required
        />
        {issues.issueDescription && (
          <p className="text-body-sm text-danger">{issues.issueDescription}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-accessories">What did they bring with the device?</Label>
        <Input
          id="ticket-accessories"
          value={values.accessoriesText}
          onChange={(e) => update("accessoriesText", e.target.value)}
          placeholder="e.g. Charger, bag"
        />
        <p className="text-body-sm text-on-surface-variant">
          Separate with commas. Leave blank if just the device.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-glass-stroke p-4">
        <div>
          <p className="text-body-md text-on-surface">This is a warranty claim</p>
          <p className="text-body-sm text-on-surface-variant">
            The repair may be covered under an existing order&apos;s warranty.
          </p>
        </div>
        <Switch
          checked={values.warrantyClaim}
          onCheckedChange={(v) => update("warrantyClaim", v)}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/service")}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create repair job"}
        </Button>
      </div>
    </form>
  );
}
