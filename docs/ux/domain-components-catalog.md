# Munaxa Domain Components

> The complete School Domain Architecture platform is documented in domain-components-architecture.md and implemented under client/src/domain-components. This document remains the Product Architecture domain catalog for backward compatibility.

## Overview

Domain components encode school concepts while data fetching, authorization, formatting, and workflow transitions remain in product layers. Import from @/design-system/components/domain.

## Shared contract

Every component supports semantic tokens, dark mode, logical layout, text-based status, and small typed props. Pass localized dates, amounts, and names. Consumers provide meaningful action labels and filter unauthorized data before rendering.

## Component catalog

### Students

StudentCard, StudentAvatar, StudentBadge, StudentTimeline, StudentStatus, GuardianSummary, and EnrollmentStatus cover identity, cohort, history, guardian relationships, and enrollment lifecycle.

### Attendance

AttendanceCard, AttendanceSummary, AttendanceStatus, AttendanceTimeline, AttendanceRiskIndicator, and ClassAttendanceWidget cover daily status, summary, corrections, intervention risk, and register completion.

### Finance

BalanceCard, InvoiceCard, PaymentCard, FeeStatusCard, CollectionSummary, and AgingCard cover balances, invoice/payment lifecycles, collection progress, and receivable aging.

### Transport

BusCard, RouteCard, DriverCard, TransportStatus, and BoardingStatus cover vehicles, assignments, trips, and rider verification.

### Communication

AnnouncementCard, NotificationCard, ConversationCard, MessageStatus, and DeliveryStatus cover governed publishing, durable notifications, messaging, and channel outcomes.

### Reporting

ReportCard, ReportMetric, ReportFilterBar, and ExportStatus cover ownership, freshness, parameters, metrics, and export lifecycle.

## Props, variants, and states

Public prop types are exported beside components. Status components accept documented string unions. Cards accept identity, description, status, metadata, and optional action slots. Timelines accept ordered event arrays. Summary components accept labelled metrics. Components include empty-safe rendering; products compose skeleton and error boundaries around them.

| Component | Overview / usage | Key props | Variants | States |
|---|---|---|---|---|
| StudentCard | Student list/search summary | name, subtitle, status, meta, action, src | default, actionable | active, pending, withdrawn, archived |
| StudentAvatar | Identity image with fallback | name, src, className | consumer-sized | image, initials fallback |
| StudentBadge | Identifier/cohort label | label | primary | default |
| StudentTimeline | Effective-dated student history | events | populated, empty | event tones |
| StudentStatus | Enrollment/operational label | status | semantic tones | active, pending, withdrawn, archived |
| GuardianSummary | Linked guardian relationship | name, relationship, phone, verified | verified/unverified | default |
| EnrollmentStatus | Enrollment lifecycle | status, detail | semantic tones | inquiry, applied, review, enrolled, withdrawn |
| AttendanceCard | Attendance KPI | label, value, status, detail | domain status | present, late, absent, excused |
| AttendanceSummary | Register totals | present, late, absent, excused | responsive grid | numeric |
| AttendanceStatus | Student attendance label | status | semantic tones | present, late, absent, excused |
| AttendanceTimeline | Corrections and resolution history | events | populated, empty | event tones |
| AttendanceRiskIndicator | Threshold intervention signal | rate, threshold | on-track/risk | below/above threshold |
| ClassAttendanceWidget | Register completion | className, marked, total, submitted | draft/submitted | empty through complete |
| BalanceCard | Outstanding amount summary | balance, label, due | default | current/overdue via copy |
| InvoiceCard | Invoice lifecycle summary | number, amount, dueDate, status | semantic status | paid, partial, due, overdue |
| PaymentCard | Payment attempt/settlement | reference, amount, method, status | semantic status | pending, settled, failed, refunded |
| FeeStatusCard | Fee obligation detail | title, amount, paid, dueDate, status | semantic status | paid, partial, due, overdue |
| CollectionSummary | Collection progress | collected, billed, rate | progress | 0–100% |
| AgingCard | Receivable age buckets | current, days30, days60, days90 | four buckets | amount values |
| BusCard | Vehicle assignment/capacity | number, plate, capacity, status | trip status | scheduled through cancelled |
| RouteCard | Route and stop summary | name, stops, status | trip status | scheduled through cancelled |
| DriverCard | Assigned driver identity | name, phone, vehicle | default | assigned |
| TransportStatus | Trip lifecycle label | status | semantic tones | scheduled, boarding, in-transit, delayed, arrived, cancelled |
| BoardingStatus | Rider verification label | status | semantic tones | not-boarded, boarded, absent, dropped-off, exception |
| AnnouncementCard | Governed broadcast summary | title, audience, status, excerpt | lifecycle status | draft through archived |
| NotificationCard | Durable actionable notification | title, body, category, actionLabel, onAction | eight categories | actionable/informational |
| ConversationCard | Message thread summary | participant, preview, unread, time | read/unread | unread count |
| MessageStatus | Communication lifecycle label | status | semantic tones | draft, review, published, sent, read, failed, archived |
| DeliveryStatus | Per-channel outcome | channel, status | semantic tones | queued, delivered, read, failed, suppressed |
| ReportCard | Report ownership/freshness | title, owner, updated, exportStatus, onOpen | actionable/read-only | export lifecycle |
| ReportMetric | Labelled report value | label, value, detail | default | populated |
| ReportFilterBar | Grouped report parameters | children, onRun, running | idle/running | enabled, disabled |
| ExportStatus | Export lifecycle label | status | semantic tones | queued, processing, ready, failed, expired |

~~~tsx
<StudentCard name="Lina Haddad" subtitle="Grade 8 · MUN-2048" status="active" />
<InvoiceCard number="INV-2041" amount="$5,000" dueDate="30 June 2026" status="partial" />
~~~

## Usage

Use domain components after permission filtering and within the documented product patterns. Format locale-sensitive values before passing them. Keep server state transitions outside presentation components.

## Accessibility

Statuses include text. Timelines use ordered lists. Icon-only actions require accessible names. Metric labels remain available to assistive technology.

## RTL

Layouts use logical flow. Isolate identifiers, currency, telephone numbers, and mixed-direction content where needed.

## Dark mode

Components use semantic surfaces, text, borders, primary, and status tokens. No neon, glow, glass, or color-only hierarchy.
