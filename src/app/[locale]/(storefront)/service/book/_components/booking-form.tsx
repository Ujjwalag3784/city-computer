"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import { ServiceDeviceType } from "@/generated/prisma/client";
import { bookServiceTicketAction } from "../_actions";

export interface BookingFormBranchOption {
  slug: string;
  name: string;
}

const DEVICE_TYPE_LABEL: Record<ServiceDeviceType, string> = {
  [ServiceDeviceType.LAPTOP]: "Laptop",
  [ServiceDeviceType.DESKTOP]: "Desktop",
  [ServiceDeviceType.MONITOR]: "Monitor",
  [ServiceDeviceType.PRINTER]: "Printer",
  [ServiceDeviceType.OTHER]: "Other",
};

export function BookingForm({ branches }: { branches: BookingFormBranchOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branchSlug, setBranchSlug] = useState(branches[0]?.slug ?? "");
  const [deviceType, setDeviceType] = useState<ServiceDeviceType>(ServiceDeviceType.LAPTOP);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [issueCategory, setIssueCategory] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [warrantyClaim, setWarrantyClaim] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setIssues({});
    try {
      const result = await bookServiceTicketAction({
        name,
        phone,
        email,
        branchSlug,
        deviceType,
        brand,
        model,
        issueCategory,
        issueDescription,
        accessoriesReceived: [],
        warrantyClaim,
      });
      if (!result.ok) {
        const fieldIssues: Record<string, string> = {};
        for (const issue of result.issues ?? []) fieldIssues[issue.field] = issue.message;
        setIssues(fieldIssues);
        return;
      }
      setTicketNumber(result.data?.ticketNumber ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketNumber) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-glass-stroke p-6">
        <p className="text-headline-sm text-on-surface">Your ticket number is {ticketNumber}</p>
        <p className="text-body-md text-on-surface-variant">
          Bring your device to the branch you selected. Use this ticket number and your phone number
          to check progress any time.
        </p>
        <Button onClick={() => router.push(`/service/status?ticketNumber=${ticketNumber}`)}>
          Check status
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-name">Your name</Label>
          <Input
            id="booking-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {issues.name && <p className="text-body-sm text-danger">{issues.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-phone">Phone number</Label>
          <Input
            id="booking-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {issues.phone && <p className="text-body-sm text-danger">{issues.phone}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-email">Email (optional)</Label>
        <Input
          id="booking-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-branch">Which branch will you bring it to?</Label>
        <Select value={branchSlug} onValueChange={setBranchSlug}>
          <SelectTrigger id="booking-branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.slug} value={branch.slug}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {issues.branchSlug && <p className="text-body-sm text-danger">{issues.branchSlug}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-device-type">Device type</Label>
          <Select value={deviceType} onValueChange={(v) => setDeviceType(v as ServiceDeviceType)}>
            <SelectTrigger id="booking-device-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ServiceDeviceType).map((type) => (
                <SelectItem key={type} value={type}>
                  {/* eslint-disable-next-line security/detect-object-injection -- `type` is a `ServiceDeviceType` enum member from `Object.values`, not arbitrary input. */}
                  {DEVICE_TYPE_LABEL[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-brand">Brand</Label>
          <Input
            id="booking-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            required
          />
          {issues.brand && <p className="text-body-sm text-danger">{issues.brand}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-model">Model (optional)</Label>
        <Input id="booking-model" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-issue-category">What&apos;s the problem, in a few words?</Label>
        <Input
          id="booking-issue-category"
          value={issueCategory}
          onChange={(e) => setIssueCategory(e.target.value)}
          placeholder="Won't turn on"
          required
        />
        {issues.issueCategory && <p className="text-body-sm text-danger">{issues.issueCategory}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-issue-description">Tell us more</Label>
        <Textarea
          id="booking-issue-description"
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          required
        />
        {issues.issueDescription && (
          <p className="text-body-sm text-danger">{issues.issueDescription}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={warrantyClaim} onCheckedChange={setWarrantyClaim} />
        <span className="text-body-sm text-on-surface-variant">This is a warranty claim</span>
      </div>

      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Booking…" : "Book repair"}
      </Button>
    </form>
  );
}
