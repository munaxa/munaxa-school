'use client';

import { TokenReference } from '@axa/platform';

/**
 * Design-token reference. Live values read off the running theme (the Platform theme tokens,
 * surfaced through globals.css). Not linked in the app nav — open /styleguide to build new
 * pages against the real palette. Toggle dark mode / `dir="rtl"` to watch tokens flip live.
 * Companion to /kitchen-sink, which showcases the component primitives.
 */
export default function StyleguidePage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold">Design tokens</h1>
        <p className="text-sm text-muted-foreground">
          The single source of truth is <code className="font-mono text-xs">@axa/platform</code>.
          Build pages with the &ldquo;Use as&rdquo; classes below — never hardcode a hex.
        </p>
      </header>
      <TokenReference />
    </main>
  );
}
