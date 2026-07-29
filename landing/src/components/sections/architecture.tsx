import {
  ShieldCheck,
  Building2,
  Languages,
  ReceiptText,
  Link2,
  Smartphone,
  KeyRound,
  Layers,
  type Icon,
} from '@axa/platform/icons';
import { Reveal } from '@axa/platform';

/**
 * Platform architecture — the enterprise substance under the product. Every claim maps to
 * something real in the Munaxa platform (multi-tenant isolation with row-level security, RBAC,
 * bilingual RTL, JoFotara e-invoicing, LMS deep-links, native mobile apps).
 */

type Capability = { icon: Icon; title: string; body: string };

const CAPS: Capability[] = [
  {
    icon: Building2,
    title: 'Multi-tenant by design',
    body: 'Run one campus or a national group. Each school’s data is isolated at the database level — one platform, never one shared pool.',
  },
  {
    icon: KeyRound,
    title: 'Role-based access',
    body: 'A permission catalog that decides exactly what owners, principals, teachers and parents can see and do.',
  },
  {
    icon: ShieldCheck,
    title: 'Security as default',
    body: 'Row-level isolation, encrypted transport and least-privilege access built into every request.',
  },
  {
    icon: Languages,
    title: 'Bilingual, RTL-native',
    body: 'Arabic and English are first-class — full right-to-left layouts, not an afterthought bolted on.',
  },
  {
    icon: ReceiptText,
    title: 'JoFotara e-invoicing',
    body: 'Jordan e-invoicing compliance built into finance — invoices originate from charges and clear through JoFotara.',
  },
  {
    icon: Link2,
    title: 'Works with your LMS',
    body: 'Deep links into Google Classroom and Microsoft Teams. Munaxa runs the school — it never duplicates your LMS.',
  },
  {
    icon: Smartphone,
    title: 'Native mobile apps',
    body: 'Dedicated experiences for parents, students and teachers — attendance, updates and fees in hand.',
  },
  {
    icon: Layers,
    title: 'One modular core',
    body: 'Every department is a module on one platform, so the whole system stays consistent as it grows.',
  },
];

export function Architecture() {
  return (
    <section id="architecture" className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div className="dot-grid pointer-events-none absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="shell">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">08 — The platform</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">Enterprise underneath.</h2>
          <p className="mt-5 text-lg text-muted-foreground">
            Beneath the calm surface is a platform built for schools that can&apos;t afford
            downtime, data leaks, or a system they&apos;ll outgrow.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {CAPS.map((c) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.title}>
                <div className="group h-full bg-background p-6 transition-colors hover:bg-secondary/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-primary-strong">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
