'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from '@axa/platform/icons';
import { buttonVariants, cn } from '@axa/platform';
import { NAV, DEMO_URL } from '@/lib/site';
import { Wordmark } from './wordmark';
import { ThemeToggle } from './theme-toggle';

/** Sticky header. Transparent over the hero, condenses to a frosted bar once the page scrolls. */
export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cn(
          'transition-colors duration-300',
          scrolled
            ? 'border-b border-border bg-background/80 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <div className="shell-wide flex h-16 items-center justify-between gap-6">
          <a href="#top" className="shrink-0" aria-label="Munaxa home">
            <Wordmark />
          </a>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-2 text-sm text-muted-foreground transition hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <a
              href={DEMO_URL}
              className={cn(buttonVariants('default', 'sm', 'group'), 'hidden sm:inline-flex')}
            >
              Book a demo
              <ArrowRight
                className="h-4 w-4 transition group-hover:translate-x-0.5"
                aria-hidden
              />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-foreground md:hidden"
            >
              {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-b border-border bg-background/95 backdrop-blur-xl md:hidden">
          <nav aria-label="Mobile" className="shell-wide flex flex-col py-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <a
              href={DEMO_URL}
              onClick={() => setOpen(false)}
              className={cn(buttonVariants('default', 'sm', 'mt-2 justify-center'))}
            >
              Book a demo
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
