import Link from 'next/link';
import { ArrowLeft } from '@axa/platform/icons';
import { Header } from './header';
import { Footer } from './footer';

/** Shared chrome for the legal pages — same header/footer, quiet editorial prose column. */
export function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="shell py-20 sm:py-28">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mono inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to home
          </Link>
          <h1 className="display mt-6 text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg text-muted-foreground">{intro}</p>
          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-2">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
