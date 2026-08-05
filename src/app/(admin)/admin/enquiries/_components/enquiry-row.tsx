"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { EnquiryStatus } from "@/generated/prisma/enums";
import { setEnquiryStatusAction } from "../_actions";
import type { AdminEnquiryListItem } from "@/server/services/admin/enquiries";

const STATUS_BADGE_VARIANT: Record<EnquiryStatus, "warning" | "glass" | "success"> = {
  [EnquiryStatus.UNREAD]: "warning",
  [EnquiryStatus.READ]: "glass",
  [EnquiryStatus.REPLIED]: "success",
  [EnquiryStatus.CLOSED]: "glass",
};

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  [EnquiryStatus.UNREAD]: "Unread",
  [EnquiryStatus.READ]: "Read",
  [EnquiryStatus.REPLIED]: "Replied",
  [EnquiryStatus.CLOSED]: "Closed",
};

export function EnquiryRow({ enquiry }: { enquiry: AdminEnquiryListItem }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleStatusChange(status: EnquiryStatus) {
    setSubmitting(true);
    try {
      const result = await setEnquiryStatusAction({ enquiryId: enquiry.id, status });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this message.");
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-glass-stroke p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-body-md font-medium text-on-surface">{enquiry.name}</span>
          {enquiry.productName && <Badge variant="glass">{enquiry.productName}</Badge>}
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[enquiry.status]}>{STATUS_LABEL[enquiry.status]}</Badge>
      </div>

      <div className="flex flex-wrap gap-3 text-body-sm text-on-surface-variant">
        {enquiry.phone && (
          <a href={`tel:${enquiry.phone}`} className="text-primary hover:underline">
            Call {enquiry.phone}
          </a>
        )}
        {enquiry.email && (
          <a
            href={`mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${enquiry.subject ?? "Your message to City Computer Systems"}`)}`}
            className="text-primary hover:underline"
          >
            Email {enquiry.email}
          </a>
        )}
      </div>

      {enquiry.subject && (
        <p className="text-body-md font-medium text-on-surface">{enquiry.subject}</p>
      )}
      <p className="text-body-sm text-on-surface-variant">{enquiry.message}</p>

      <div className="flex flex-wrap gap-2">
        {enquiry.status === EnquiryStatus.UNREAD && (
          <Button
            size="sm"
            variant="outline"
            disabled={submitting}
            onClick={() => void handleStatusChange(EnquiryStatus.READ)}
          >
            Mark as read
          </Button>
        )}
        {enquiry.status !== EnquiryStatus.REPLIED && (
          <Button
            size="sm"
            disabled={submitting}
            onClick={() => void handleStatusChange(EnquiryStatus.REPLIED)}
          >
            Mark as replied
          </Button>
        )}
        {enquiry.status !== EnquiryStatus.CLOSED && (
          <Button
            size="sm"
            variant="outline"
            disabled={submitting}
            onClick={() => void handleStatusChange(EnquiryStatus.CLOSED)}
          >
            Close
          </Button>
        )}
      </div>
    </li>
  );
}
