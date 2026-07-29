import { FOOTER_GROUPS } from '@/lib/site';
import { Wordmark } from './wordmark';

const YEAR = new Date().getFullYear();

/** Footer — restrained, editorial, multi-column. Minimal but premium; no clutter. */
export function Footer() {
  return (
    <footer className="border-t border-border py-16 sm:py-20">
      <div className="shell-wide">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))] lg:gap-8">
          {/* Brand */}
          <div className="max-w-xs">
            <Wordmark variant="wordmark" className="h-7" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The School Operating System for K-12 schools and education groups — Jordan and the
              wider region.
            </p>
          </div>

          {/* Link groups */}
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {group.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => {
                  const isEmail = link.href.startsWith('mailto:');
                  return (
                    <li key={`${group.title}-${link.label}`}>
                      <a
                        href={link.href}
                        className={
                          'text-sm text-muted-foreground transition hover:text-foreground' +
                          (isEmail ? ' mono break-all' : '')
                        }
                      >
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule mt-14" />
        <div className="mt-6 flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {YEAR} Munaxa. All rights reserved.</p>
          <p>Not an LMS · a School Operating System.</p>
        </div>
      </div>
    </footer>
  );
}
