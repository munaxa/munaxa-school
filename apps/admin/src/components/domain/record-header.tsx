import type { ReactNode } from 'react';
import { Badge } from '@axa/platform';

/**
 * Record Workspace header (Munaxa DS): identity block (initials/avatar + title + optional
 * secondary/Arabic name), a status chip, extra badges, and a trailing actions slot.
 * Shared across record workspaces (Student/Teacher/Parent/Employee) so headers stay consistent.
 */
export function RecordHeader({
  initials,
  title,
  subtitle,
  status,
  badges,
  actions,
}: {
  initials: string;
  title: ReactNode;
  /** Secondary line (e.g. Arabic name); caller sets dir if needed. */
  subtitle?: ReactNode;
  status?: { label: ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted' };
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary font-display text-xl font-semibold">
          {initials}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-x-3">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {subtitle ? <span className="text-muted-foreground">{subtitle}</span> : null}
          </div>
          {status || badges ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {status ? <Badge tone={status.tone ?? 'default'}>{status.label}</Badge> : null}
              {badges}
            </div>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
