"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/commerce/rating-stars";
import { cn } from "@/lib/utils";

/**
 * ReviewForm — docs/06-DATA-MODEL.md `Review` model (`rating`, `title`,
 * `body`, `status`) + docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §2.1: "Reviews
 * with verified-buyer flag and moderation."
 *
 * `"use client"` for form state (rating selection, field values, submitted
 * state). Purely a callback-driven form — no invented backend call. The
 * caller wires `onSubmit` to a real API in a later integration phase; this
 * component only validates and hands off `{ rating, title, body }`.
 *
 * Validation: `rating` is required (must be 1–5, enforced via the
 * interactive `RatingStars` picker) and `body` is required (an empty review
 * with only a star rating carries no useful signal for other shoppers).
 * `title` is optional — many real-world review UIs (and reviewers) skip a
 * headline entirely, and nothing about the `Review` model marks it
 * mandatory beyond its own type.
 *
 * On success, the form is replaced with an honest confirmation reflecting
 * the real moderation flow (`Review.status` starts `PENDING` until an admin
 * approves it) — same submitted-state pattern as `newsletter-form.tsx`
 * (flip a `status` union to a terminal state and render a short message in
 * place of the form), rather than implying the review is already live.
 */
export interface ReviewFormProps {
  onSubmit: (review: { rating: number; title: string; body: string }) => void | Promise<void>;
  className?: string;
}

export function ReviewForm({ onSubmit, className }: ReviewFormProps) {
  const [rating, setRating] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "pending" | "submitted">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    if (body.trim().length === 0) {
      setError("Please write a few words about your experience.");
      return;
    }

    setError(null);
    setStatus("pending");
    await onSubmit({ rating, title: title.trim(), body: body.trim() });
    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <div className={cn("flex items-center gap-2 text-body-sm text-on-surface", className)}>
        <CheckCircle2 className="size-4 text-primary-container" aria-hidden="true" />
        <p>Thanks for your review — it&apos;ll appear once it&apos;s been checked.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="text-body-sm text-on-surface">Your rating</span>
        <RatingStars rating={rating} readOnly={false} onRatingChange={setRating} />
      </div>

      <Input
        aria-label="Review title"
        placeholder="Sum up your experience"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <Textarea
        aria-label="Review"
        placeholder="Tell others what you liked or didn't"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-body-sm text-error">
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={status === "pending"}
        className="self-start"
      >
        Submit review
      </Button>
    </form>
  );
}
