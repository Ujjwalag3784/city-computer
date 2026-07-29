import type { Metadata } from "next";
import Link from "next/link";
import { listActiveBranches } from "@/server/services/content/stores";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Our stores — City Computer Systems",
  description: "Find a City Computer Systems store near you in Nepal.",
};

/** `/stores` — docs/02's route table, ISR 3600s. */
export default async function StoresPage() {
  const branches = await listActiveBranches();

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 p-4 sm:p-8">
      <h1 className="text-display-sm text-on-surface">Our stores</h1>

      {branches.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No stores listed yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {branches.map((branch) => (
            <Link
              key={branch.slug}
              href={`/stores/${branch.slug}`}
              className="flex flex-col gap-1 rounded-lg border border-glass-stroke p-4 hover:border-primary-container"
            >
              <p className="text-headline-sm text-on-surface">{branch.name}</p>
              <p className="text-body-sm text-on-surface-variant">{branch.addressLine}</p>
              <p className="text-body-sm text-on-surface-variant">{branch.district}</p>
              <p className="text-body-sm text-on-surface-variant">{branch.phone}</p>
              {branch.isPickupEnabled && (
                <p className="text-body-sm text-primary">Pickup available</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
