import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableStatic, type DataTableColumn } from "@/components/admin/data-table-static";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { formatRelativeTime } from "@/lib/date";
import {
  listStaffForAdmin,
  STAFF_ROLE_DESCRIPTIONS,
  type AdminStaffListItem,
} from "@/server/services/admin/staff";
import type { StaffRoleKey } from "@/lib/validation/admin/staff";
import { StaffRoleSelect } from "./_components/staff-role-select";
import { StaffStatusToggle } from "./_components/staff-status-toggle";

export const metadata: Metadata = { title: "Staff accounts — Admin — City Computer Systems" };

/** `/admin/users` — docs/09-ADMIN-DAD-MODE.md §12, OWNER only. */
export default async function AdminUsersPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "user:manage");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/users");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const staff = await listStaffForAdmin();
  const currentUserId = session?.user.id;

  const columns: DataTableColumn<AdminStaffListItem>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-on-surface">{row.name ?? "Unnamed"}</span>
          <span className="text-body-sm text-on-surface-variant">{row.email ?? row.phone}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => {
        const roleKey = (row.roleKeys[0] ?? "STAFF") as StaffRoleKey;
        return <StaffRoleSelect userId={row.id} roleKey={roleKey} />;
      },
    },
    {
      key: "lastLoginAt",
      header: "Last signed in",
      render: (row) =>
        row.lastLoginAt ? (
          <span className="text-body-sm text-on-surface-variant">
            {formatRelativeTime(row.lastLoginAt)}
          </span>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Never</span>
        ),
    },
    {
      key: "status",
      header: "Active",
      render: (row) =>
        row.id === currentUserId ? (
          <Badge variant="glass">You</Badge>
        ) : (
          <StaffStatusToggle userId={row.id} isActive={row.status === "ACTIVE"} />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Staff accounts</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Everyone who can sign in to this admin, and what they&apos;re allowed to do.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">Add a staff member</Link>
        </Button>
      </div>

      <DataTableStatic
        columns={columns}
        rows={staff}
        getRowId={(row) => row.id}
        emptyMessage="No staff accounts yet."
      />

      <div className="flex flex-col gap-2 rounded-xl border border-glass-stroke p-4">
        <p className="text-body-sm font-medium text-on-surface">What each role can do</p>
        {Object.values(STAFF_ROLE_DESCRIPTIONS).map((role) => (
          <p key={role.label} className="text-body-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">{role.label}</span> — {role.description}
          </p>
        ))}
      </div>
    </div>
  );
}
