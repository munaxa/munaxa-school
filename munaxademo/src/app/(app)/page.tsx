'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session-context';
import { Spinner } from '@axa/platform';

/** Index → send each persona to its natural landing page. */
export default function Index() {
  const router = useRouter();
  const { persona } = useSession();
  useEffect(() => {
    router.replace(persona.home as never);
  }, [persona.home, router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
      <Spinner /> Loading…
    </div>
  );
}
