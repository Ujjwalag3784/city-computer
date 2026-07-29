"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReviewStatus } from "@/generated/prisma/client";
import { setReviewStatusAction, replyToReviewAction } from "../_actions";
import type { AdminReviewListItem } from "@/server/services/admin/reviews";

const STATUS_BADGE_VARIANT: Record<ReviewStatus, "success" | "warning" | "danger"> = {
  [ReviewStatus.PENDING]: "warning",
  [ReviewStatus.APPROVED]: "success",
  [ReviewStatus.REJECTED]: "danger",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: "Needs approval",
  [ReviewStatus.APPROVED]: "Approved",
  [ReviewStatus.REJECTED]: "Rejected",
};

export function ReviewRow({ review }: { review: AdminReviewListItem }) {
  const router = useRouter();
  const [reply, setReply] = useState(review.adminReply ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleStatusChange(status: ReviewStatus) {
    setSubmitting(true);
    try {
      const result = await setReviewStatusAction({ reviewId: review.id, status });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this review.");
        return;
      }
      toast(
        status === ReviewStatus.APPROVED
          ? "Review approved — now live on the website."
          : "Review rejected — customers won't see it.",
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply() {
    setSubmitting(true);
    try {
      const result = await replyToReviewAction({ reviewId: review.id, reply });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save your reply.");
        return;
      }
      toast("Reply saved.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-glass-stroke p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={
                  i < review.rating
                    ? "size-4 fill-warning text-warning"
                    : "size-4 text-on-surface-variant"
                }
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="text-body-md font-medium text-on-surface">{review.authorName}</span>
          {review.isVerifiedPurchase && <Badge variant="glass">Verified purchase</Badge>}
        </div>
        <Badge variant={STATUS_BADGE_VARIANT[review.status]}>{STATUS_LABEL[review.status]}</Badge>
      </div>

      <a
        href={`/admin/products/${review.productId}/edit`}
        className="text-body-sm text-primary hover:underline"
      >
        {review.productName}
      </a>

      {review.title && <p className="text-body-md font-medium text-on-surface">{review.title}</p>}
      <p className="text-body-sm text-on-surface-variant">{review.body}</p>

      <div className="flex flex-wrap gap-2">
        {review.status !== ReviewStatus.APPROVED && (
          <Button
            size="sm"
            disabled={submitting}
            onClick={() => void handleStatusChange(ReviewStatus.APPROVED)}
          >
            Approve
          </Button>
        )}
        {review.status !== ReviewStatus.REJECTED && (
          <Button
            size="sm"
            variant="outline"
            disabled={submitting}
            onClick={() => void handleStatusChange(ReviewStatus.REJECTED)}
          >
            Reject
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-glass-stroke pt-3">
        <label htmlFor={`reply-${review.id}`} className="text-body-sm text-on-surface-variant">
          Your reply (shown publicly under this review)
        </label>
        <Textarea
          id={`reply-${review.id}`}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Thank the customer, or address their concern..."
          rows={2}
        />
        <Button
          size="sm"
          variant="outline"
          className="self-end"
          disabled={submitting || reply.trim() === (review.adminReply ?? "")}
          onClick={() => void handleReply()}
        >
          Save reply
        </Button>
      </div>
    </li>
  );
}
