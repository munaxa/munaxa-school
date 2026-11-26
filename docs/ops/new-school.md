# Adding a school

Munaxa operators manage School customers in **Munaxa Control** (customers, plans, subscriptions,
licences, usage; `control-test.munaxa.com` on Testing). School itself has no operator console and
no `admin.munaxa.com`: its old Platform Console was removed on 26 Nov 2026 (owner decision). The
school's own staff run their school from the portal's **Administration** section.

## Steps

1. **Add the school in School.** Run the provisioning task once, with the API's database settings:

   ```bash
   SCHOOL_SLUG=al-noor SCHOOL_NAME='Al Noor School' ADMIN_EMAIL=principal@al-noor.example \
   ADMIN_FIRST_NAME=Rana ADMIN_LAST_NAME=Haddad \
   pnpm --filter @school/api school:provision             # dry run: prints what it would do
   APPLY=yes ... pnpm --filter @school/api school:provision # does it
   ```

   From the API image it is `node dist/ops/provision-school.js`. It creates the school (ACTIVE), its
   system roles and one `SchoolAdmin` with **no School password**. It is idempotent and never
   changes an existing user. The **Seed environment** workflow can run it too (`school_slug`,
   `school_name`, `school_admin_email`).
2. **Pair it with Munaxa Identity** ([identity-sign-in.md](../security/identity-sign-in.md#pairing-a-school-with-identity)):
   an Identity client for the school, and the administrator's Identity account with the same email,
   checked (`operator-cli account-email-verified`) and with two-step verification on.
3. **License it in Control.** The school calls Control for its entitlements on first use, so Control
   lists it under *Link tenant*; link it to the customer and give it a subscription.
4. The administrator signs in at the School portal with **Sign in with Munaxa**, then adds staff,
   parents and students under **Administration**.

## What moved to Control

| Was in School's console | Now |
| --- | --- |
| Schools, organisations, subscriptions, trials, plans and plan versions, coupons, feature overrides, upgrade requests | Munaxa Control (customers, catalogue, subscriptions, licences) |
| Munaxa billing to schools (invoices, payments) | Munaxa Control |
| Platform audit, dashboard, revenue | Munaxa Control reports and audit |
| Tenant databases (pool to dedicated) | `pnpm --filter @school/api promote:tenant` (operator script, unchanged) |
| Outbound platform webhooks | Removed (no subscribers; Control owns lifecycle events) |
| Platform owner account (`db:seed:platform-owner`) | Removed: Munaxa staff use Control, signed in through Identity |

The subscription tables and platform roles stay in the schema for now (no data migration); they
are unused when `LICENSING_MODE=CONTROL_PLANE`, which production requires.
