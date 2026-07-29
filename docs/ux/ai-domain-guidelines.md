# Munaxa Domain AI Guidelines

## Shared method

Before generating a screen, identify user role, capability, school/campus/class scope, decision, workflow state, notification consequences, locale, direction, dark mode, device, and data sensitivity. Select an approved pattern and compose public APIs from client/src/domain-components.

## Student screens

Use StudentProfileHeader for persistent identity, StudentMetrics for a maximum of four signals, StudentIdentityPanel and StudentInfoGrid for facts, GuardianSummary for verified relationships, StudentDocumentsPanel for files, and StudentTimeline for effective-dated history. Never expose finance, safeguarding, health, or private notes without separate capabilities.

## Attendance screens

Use AttendanceSummary or AttendanceMetrics for aggregates, AttendanceClassWidget for register completion, AttendanceStatusBadge for text status, AttendanceRiskIndicator for threshold logic, AttendanceExceptionCard for resolution work, and AttendanceTimeline for corrections. Treat submission and resolution as workflow transitions; never overwrite history silently.

## Finance screens

Use FinanceMetrics, CollectionSummary, AgingCard, BalanceCard, InvoiceCard, PaymentCard, ReceiptCard, and TransactionTimeline. Always show currency, period, posting/settlement state, and scope. Refunds and write-offs follow approval policy and immutable reversals.

## Teacher screens

Use TeacherProfileHeader, TeacherScheduleCard, TeacherWorkloadCard, TeacherSubjectsPanel, TeacherAttendanceCard, and TeacherMetrics. Teacher views are assignment scoped and never include student finance or private staff HR data.

## Parent screens

Use ParentProfileHeader, ParentChildrenList, GuardianRelationshipCard, ParentContactCard, ParentCommunicationCard, and ParentMetrics. Only render verified linked children. Keep each child’s context explicit and protect sensitive notification previews.

## Reports screens

Use ReportFilterBar, ReportMetric, ReportSummary, ReportVisualizationWrapper, ReportCard, ReportScheduleCard, ReportInsightCard, ReportTrendCard, and ReportExportStatus. Show owner, scope, parameters, units, freshness, and export lifecycle. Tables remain available as accessible alternatives to charts.

## Transport and communication screens

Transport screens use route, bus, driver, trip, boarding, and vehicle components with safety exceptions visible and acknowledged. Communication screens use governed lifecycle, recipient scope, durable notification state, channel delivery status, and privacy-safe previews.

## Page composition

Order pages as context/header, primary action, up to four metrics, primary workflow, exceptions, supporting detail, history. Keep filters beside affected content. Include loading, empty, partial, error, denied, read-only, approval-pending, conflict, and offline states where relevant.

## Component choice

Choose the most specific domain component that matches the business concept. Use shared components only to create a documented missing concept. Use generic UI primitives only inside domain components or for standard form controls. Do not recreate an existing public API with utility classes.

## Consistency checklist

- Existing Munaxa tokens, typography, spacing, and iconography retained.
- Permission filtering and resource scope explicit.
- Workflow states and valid transitions server owned.
- Notifications emitted from domain events.
- Semantic statuses and accessible names present.
- Arabic-first RTL and restrained enterprise dark mode verified.
- No emoji icons, raw colors, physical-direction layout, neon, glow, or glass.

