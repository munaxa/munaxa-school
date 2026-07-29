'use client';

import { useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { useToast } from '@axa/platform';

/**
 * Permanent demonstration banner shown on every authenticated page. Also offers an
 * on-demand "Reset demo data" action (the same reset that runs on logout / refresh).
 */
export function DemoBanner() {
  const { actions } = useDemo();
  const toast = useToast();
  const [resetting, setResetting] = useState(false);

  function onReset() {
    setResetting(true);
    actions.reset();
    toast.success('All demo data has been restored to the original seeded state.', 'Demo reset');
    setTimeout(() => setResetting(false), 600);
  }

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground">
      <span>
        This is a demonstration environment. All data is fictional. Changes are temporary and
        automatically reset.
      </span>
      <button
        onClick={onReset}
        disabled={resetting}
        className="rounded-md bg-background/20 px-2 py-0.5 text-[11px] font-semibold underline-offset-2 transition hover:bg-background/30 disabled:opacity-60"
      >
        {resetting ? 'Resetting…' : 'Reset demo data'}
      </button>
    </div>
  );
}
