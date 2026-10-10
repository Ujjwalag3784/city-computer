import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface HubLink {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}

/**
 * A grid of big, plainly-labelled tiles leading to admin sections that
 * don't have their own sidebar row (the Content hub, the owner tools under
 * Settings). Each tile says in one line what the section is for.
 */
export function HubLinkGrid({ title, links }: { title?: string; links: HubLink[] }) {
  if (links.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <h2 className="font-mono text-label-mono-xs tracking-[0.12em] text-on-surface-variant uppercase">
          {title}
        </h2>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group flex h-full items-start gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-4 transition-colors hover:border-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-container-high text-primary [&_svg]:size-5">
                {link.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-body-lg font-medium text-on-surface">{link.title}</span>
                <span className="text-body-sm text-on-surface-variant">{link.description}</span>
              </span>
              <ChevronRight
                className="mt-2 size-4 shrink-0 text-on-surface-variant transition-colors group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
