/** Central site configuration for the Munaxa landing site. */
export const SITE_NAME = 'Munaxa';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.munaxa.com').replace(
  /\/+$/,
  '',
);

/**
 * The standalone Munaxa demo app's public "Request a Demo" form (deployed separately —
 * see the `munaxademo` app, hosted at demo.munaxa.com). Override with NEXT_PUBLIC_DEMO_URL.
 */
export const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? 'https://demo.munaxa.com/request-demo';

export const CONTACT_EMAIL = 'info@munaxa.com';

/**
 * Sender address for the internal inquiry notification delivered to {@link CONTACT_EMAIL}.
 * The domain must be verified in Resend. Override with EMAIL_CONTACT_FROM.
 */
export const CONTACT_FROM_EMAIL =
  process.env.EMAIL_CONTACT_FROM ?? 'Munaxa Contact <contactus@munaxa.com>';

/**
 * Browser-chrome theme colors for <meta name="theme-color">. Consumed as raw hex by the browser
 * (not Tailwind classes), so the design-token class rule does not apply. Values mirror the
 * design-system light/dark backgrounds (neutral.0 / ink.900).
 */
// eslint-disable-next-line no-restricted-syntax
export const THEME_COLOR_LIGHT = '#ffffff';
// eslint-disable-next-line no-restricted-syntax
export const THEME_COLOR_DARK = '#090b0c';

/** In-page anchors — the narrative sections of the operating system. */
export const NAV = [
  { href: '#operating-system', label: 'The System' },
  { href: '#admissions', label: 'Admissions' },
  { href: '#finance', label: 'Finance' },
  { href: '#intelligence', label: 'Intelligence' },
  { href: '#architecture', label: 'Platform' },
  { href: '#contact', label: 'Contact' },
] as const;

/**
 * Footer link groups. Every href resolves to a real in-page section, the demo app, a mailto, or a
 * real legal page — no dead or placeholder links.
 */
export const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { href: '#operating-system', label: 'The operating system' },
      { href: '#admissions', label: 'Admissions' },
      { href: '#finance', label: 'Finance' },
      { href: '#intelligence', label: 'Intelligence' },
      { href: '#architecture', label: 'Architecture' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { href: '#operating-system', label: 'K-12 schools' },
      { href: '#architecture', label: 'Multi-campus groups' },
      { href: '#finance', label: 'Finance & JoFotara' },
      { href: '#communication', label: 'Parent engagement' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '#top', label: 'Overview' },
      { href: '#operating-system', label: 'How it connects' },
      { href: DEMO_URL, label: 'Book a demo' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
      { href: '#contact', label: 'Contact us' },
      { href: DEMO_URL, label: 'Request a demo' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
];
