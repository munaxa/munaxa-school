'use client';

import Link from 'next/link';
import type { Route } from 'next';

/** Shared sub-navigation for the Platform Console pages. */
export function PlatformNav({ active }: { active: string }) {
  const items: Array<{ key: string; href: Route; label: string }> = [
    { key: 'dashboard', href: '/platform/console', label: 'Dashboard' },
    { key: 'schools', href: '/platform/console/schools', label: 'Schools' },
    { key: 'organizations', href: '/platform/console/organizations', label: 'Organizations' },
    { key: 'subscriptions', href: '/platform/console/subscriptions', label: 'Subscriptions' },
    { key: 'upgrades', href: '/platform/console/upgrade-requests', label: 'Upgrades' },
    { key: 'webhooks', href: '/platform/console/webhooks', label: 'Webhooks' },
    { key: 'audit', href: '/platform/console/audit', label: 'Audit' },
  ];
  return (
    <nav className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={[
            'rounded-md px-3 py-1.5 text-sm font-medium transition',
            i.key === active
              ? 'bg-primary/10 text-primary-strong'
              : 'text-muted-foreground hover:bg-secondary/60',
          ].join(' ')}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
