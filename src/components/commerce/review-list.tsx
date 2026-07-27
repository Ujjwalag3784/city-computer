import { BadgeCheck } from "lucide-react";
import { RatingStars } from "@/components/commerce/rating-stars";
import { formatKathmanduDate } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * ReviewList — docs/06-DATA-MODEL.md `Review` model (`authorName`, `rating`,
 * `title`, `body`, `isVerifiedPurchase`, `status`, `adminReply`,
 * `helpfulCount`) + docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §2.1: "Reviews
 * with verified-buyer flag and moderation."
 *
 * Only `Review.status === "APPROVED"` reviews are ever shown to customers
 * (docs/06 §Review model + docs/02 §2.1's "moderation" clause) — filtering
 * by status is a data-layer/query concern upstream of this component, so
 * `ReviewList` assumes every item in `reviews` is already public. It DOES
 * render the verified-buyer badge and any admin reply, since both are
 * customer-facing once a review is approved.
 *
 * Verified-purchase status is icon + text together (`BadgeCheck` +
 * "Verified purchase"), never colour alone, per docs/05 §5 A6.
 *
 * `helpfulCount` renders as plain read-only text rather than a clickable
 * "Was this helpful?" control — marking a review helpful is a mutation
 * against a backend that doesn't exist yet in this phase, so wiring a
 * `"use client"` interaction here would just be a fake affordance with
 * nowhere real to send the click. This keeps `ReviewList` a plain,
 * server-renderable function component.
 */
export interface ReviewData {
  id: string;
  authorName: string;
  /** 1–5. */
  rating: number;
  title?: string;
  body: string;
  isVerifiedPurchase: boolean;
  /** ISO date string. */
  createdAt: string;
  adminReply?: string;
  helpfulCount?: number;
}

export interface ReviewListProps {
  reviews: ReviewData[];
  className?: string;
}

export function ReviewList({ reviews, className }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <p className={cn("text-body-sm text-on-surface-variant", className)}>
        No reviews yet — be the first to review this product.
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-6", className)}>
      {reviews.map((review) => (
        <li
          key={review.id}
          className="flex flex-col gap-2 border-b border-glass-stroke pb-6 last:border-b-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-md font-medium text-on-surface">{review.authorName}</span>
            {review.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                <BadgeCheck className="size-4 text-primary-container" aria-hidden="true" />
                Verified purchase
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RatingStars rating={review.rating} size="sm" />
            <time dateTime={review.createdAt} className="text-body-sm text-on-surface-variant">
              {formatKathmanduDate(new Date(review.createdAt))}
            </time>
          </div>

          {review.title && (
            <p className="text-body-md font-medium text-on-surface">{review.title}</p>
          )}
          <p className="text-body-sm text-on-surface-variant">{review.body}</p>

          {typeof review.helpfulCount === "number" && (
            <p className="text-body-sm text-on-surface-variant">
              {review.helpfulCount} {review.helpfulCount === 1 ? "person" : "people"} found this
              helpful
            </p>
          )}

          {review.adminReply && (
            <div className="ml-6 mt-2 border-l-2 border-glass-stroke pl-4">
              <p className="text-label-mono-xs text-on-surface-variant">
                Response from City Computer
              </p>
              <p className="text-body-sm text-on-surface-variant">{review.adminReply}</p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
