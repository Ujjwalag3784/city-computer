import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { formatRelativeTime } from "@/lib/date";
import { getTicketForAdmin } from "@/server/services/admin/service-tickets";
import { availableTicketTransitions } from "@/server/services/service/ticket-state-machine";
import { TicketTransitionPanel } from "./_components/ticket-transition-panel";
import { TicketNotes } from "./_components/ticket-notes";
import { TicketTimeline } from "./_components/ticket-timeline";

export const metadata: Metadata = { title: "Repair job — Admin — City Computer Systems" };

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function AdminServiceTicketDetailPage({ params }: TicketDetailPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "service-ticket:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/service/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let ticket;
  try {
    ticket = await getTicketForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const nextStatuses = availableTicketTransitions(ticket.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-md text-on-surface">{ticket.ticketNumber}</h1>
          <Badge variant="glass">{statusLabel(ticket.status)}</Badge>
          {ticket.warrantyClaim && <Badge variant="primary">Warranty claim</Badge>}
        </div>
        <p className="text-body-sm text-on-surface-variant">
          Received {formatRelativeTime(ticket.receivedAt)} at {ticket.branchName} · {ticket.name} ·{" "}
          {ticket.phone}
        </p>
      </div>

      <TicketTransitionPanel ticketId={ticket.id} nextStatuses={nextStatuses} />

      <Card variant="surface">
        <CardContent className="flex flex-col gap-2 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Device</h2>
          <p className="text-body-sm text-on-surface-variant">
            {ticket.brand} {ticket.model ?? ""} ({ticket.deviceType})
          </p>
          {ticket.serialNumber && (
            <p className="text-body-sm text-on-surface-variant">Serial: {ticket.serialNumber}</p>
          )}
          {ticket.accessoriesReceived.length > 0 && (
            <p className="text-body-sm text-on-surface-variant">
              Received with: {ticket.accessoriesReceived.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-2 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">The problem</h2>
          <p className="text-body-sm text-on-surface-variant">{ticket.issueCategory}</p>
          <p className="text-body-md text-on-surface">{ticket.issueDescription}</p>
        </CardContent>
      </Card>

      {(ticket.estimatedCostPaisa !== null || ticket.finalCostPaisa !== null) && (
        <Card variant="surface">
          <CardContent className="flex flex-col gap-2 pt-[--space-card-padding]">
            <h2 className="text-body-lg font-medium text-on-surface">Cost</h2>
            {ticket.estimatedCostPaisa !== null && (
              <p className="text-body-sm text-on-surface-variant">
                Estimated: {formatNPR(ticket.estimatedCostPaisa)}
              </p>
            )}
            {ticket.finalCostPaisa !== null && (
              <p className="text-body-md text-on-surface">
                Final: {formatNPR(ticket.finalCostPaisa)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Internal notes</h2>
          <p className="text-body-sm text-on-surface-variant">Only your team sees this.</p>
          <TicketNotes ticketId={ticket.id} initialNotes={ticket.internalNotes} />
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">History</h2>
          <TicketTimeline events={ticket.events} />
        </CardContent>
      </Card>
    </div>
  );
}
