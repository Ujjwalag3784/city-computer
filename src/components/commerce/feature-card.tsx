import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * FeatureCard — docs/05-DESIGN-SYSTEM.md §8 home page structure: "→ value
 * props →" section, built on the shared `Card` primitive (`variant="surface"`)
 * per the component inventory in §6. Pairs with `TrustRow` for the same
 * pre-footer value-props band; use this variant when a value prop needs a
 * longer description than a one-line trust signal.
 */
export interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon: Icon, title, description, className }: FeatureCardProps) {
  return (
    <Card variant="surface" className={cn(className)}>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary-container/10 text-primary-container">
          <Icon className="size-6" />
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </CardContent>
    </Card>
  );
}
