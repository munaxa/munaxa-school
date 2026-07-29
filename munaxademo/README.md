# Munaxa Demo

A secure, **fully isolated**, **database-free** live demonstration of the Munaxa School
Operating System. It lets prospective school owners explore a complete, realistic school —
**Munaxa Academy** — across eight roles, without touching any production system, database, or
external service.

> This is a **standalone project**. It does **not** import from or depend on the Munaxa monorepo,
> so it can be lifted into its own repository (`munaxademo`) and deployed independently. The
> Munaxa design system (logo, colours, typography, spacing, components, shadows) is **vendored**
> here verbatim so the demo looks and feels identical to production.

---

## Highlights

- **No database.** All data is generated from TypeScript seed files into an in-memory baseline.
- **Session-only changes.** Create/edit/delete anything — students, attendance, invoices,
  announcements. Nothing is persisted; everything resets to the seeded baseline.
- **8 roles** with different permissions, dashboards and navigation: School Owner, Principal,
  Registrar, Finance Manager, Teacher, Parent, Student, Bus Supervisor. Prospect accounts are
  locked to an assigned role; the admin can switch freely.
- **Sales-driven access (Book a Demo).** No public credentials. A prospect submits a request,
  the team reviews/contacts/schedules, then an admin **provisions** a role-locked, time-boxed
  account from the approved request. A signed, httpOnly session cookie gates every route.
- **All integrations mocked.** Email, SMS, WhatsApp, push, JoFotara e-invoicing and payments are
  stubbed and recorded in an in-app outbox — never sent. The CSP blocks all outbound connections.
- **Guided onboarding** + a permanent demo banner with one-click reset.

## Quick start

```bash
cd munaxademo
cp .env.example .env          # optional: set DEMO_SESSION_SECRET
npm install                   # or: pnpm install --ignore-workspace
npm run dev                   # http://localhost:4100
```

Build for production (Node):

```bash
npm run build && npm run start
```

Deploy to **Cloudflare Workers** (built only from this isolated subfolder, via OpenNext):

```bash
npx wrangler kv namespace create DEMO_ACCOUNTS   # → paste id into wrangler.jsonc
npx wrangler secret put DEMO_SESSION_SECRET      # openssl rand -base64 48
npm run cf:deploy
```

See [`docs/deployment.md`](./docs/deployment.md) for the full Cloudflare guide (KV, CPU limits,
custom domain, dashboard "root directory = munaxademo").

## Access model — Book a Demo

The demo is **not** publicly accessible. The flow is sales-driven:

1. Visitor clicks **Book a Demo** on the landing page → `/request-demo` (public form).
2. The request lands in **Demo requests** (admin). The team marks it Contacted → Scheduled →
   **Approved** (or Rejected).
3. From an approved request the admin clicks **Create account** → assigns a role + expiry → the
   account is provisioned and the request becomes **Converted**.
4. Credentials are shared manually with the prospect, who signs in at `/login`. Their account is
   **locked to its assigned role** and **expires automatically**.

### Built-in account

| Username       | Password           | Notes                                                  |
| -------------- | ------------------ | ------------------------------------------------------ |
| `munaxa-admin` | `MunaxaAdmin#2026` | Demo admin: reviews requests, provisions/manages accts |

> A sample provisioned prospect account `futureacademy-demo` / `X9P4M2K8` (role: School Owner,
> 7-day expiry) is seeded for testing. Remove it from `src/seed/accounts.ts` for a clean deploy.

## Documentation

- [`docs/architecture.md`](./docs/architecture.md) — how the demo works and stays isolated.
- [`docs/security.md`](./docs/security.md) — the security model and threat boundaries.
- [`docs/deployment.md`](./docs/deployment.md) — deploying to the cloud.

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS (vendored Munaxa preset).
No backend, no database, no external network calls.
