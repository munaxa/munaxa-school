import type { LucideIcon } from "lucide-react";
import { BellRing, Bot, Boxes, GitBranch, ShieldCheck } from "lucide-react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ArchitectureSection { title: string; description: string; items: string[] }
interface ArchitecturePageProps { path: string; eyebrow: string; title: string; description: string; icon: LucideIcon; sections: ArchitectureSection[] }

function ArchitecturePage({ path, eyebrow, title, description, icon: Icon, sections }: ArchitecturePageProps) {
  return <Layout currentPage={path}><div className="mx-auto max-w-6xl space-y-10 px-6 py-12"><header className="flex items-start gap-4"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-7" aria-hidden /></span><div><p className="text-sm font-medium text-primary">{eyebrow}</p><h1 className="mt-1 text-4xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-3xl text-lg text-muted-foreground">{description}</p></div></header><section aria-label={title} className="grid gap-5 md:grid-cols-2">{sections.map(section => <Card key={section.title}><CardHeader><CardTitle>{section.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{section.description}</p><ul className="mt-4 list-disc space-y-2 ps-5 text-sm">{section.items.map(item => <li key={item}>{item}</li>)}</ul></CardContent></Card>)}</section><footer className="rounded-xl border bg-muted/20 p-5 text-sm text-muted-foreground"><strong className="text-foreground">Implementation standard:</strong> use semantic tokens, visible scope, keyboard-accessible actions, non-color status cues, logical RTL layout, and restrained enterprise dark mode.</footer></div></Layout>;
}

export function PermissionArchitecturePage() { return <ArchitecturePage path="/product-architecture/permissions" eyebrow="Product Architecture" title="Permission patterns" description="Capability, scope, record state, approval, and safe permission UX for every Munaxa role." icon={ShieldCheck} sections={[
  {title:"Role model",description:"Nine roles receive capabilities constrained by resource scope.",items:["Super Admin and School Owner govern platform or organization scope.","Principal, Vice Principal, Registrar, and Finance Officer receive delegated operational capabilities.","Teacher, Parent, and Student access is assignment, relationship, or self scoped."]},
  {title:"Visibility and actions",description:"Server filtering is authoritative and UI reflects—not enforces—access.",items:["Teachers never receive financial data.","Parents see verified linked children only.","Write-offs and student archival require elevated approval."]},
  {title:"Data segmentation",description:"Boundaries follow data through every system.",items:["Tenant and school isolation","Campus and class assignments","Field-level protection for finance, health, safeguarding, and HR"]},
  {title:"Permission UX",description:"Choose hidden, disabled, read-only, approval, or denied states deliberately.",items:["Hide permanently unavailable sensitive actions.","Disable state-dependent actions with a reason.","Use a 403 page only when the route itself is unauthorized."]},
]} />; }

export function WorkflowArchitecturePage() { return <ArchitecturePage path="/product-architecture/workflows" eyebrow="Product Architecture" title="Workflow patterns" description="Versioned server-owned state machines with explicit transitions, approvals, notifications, and recovery." icon={GitBranch} sections={[
  {title:"Admissions",description:"Inquiry → Application → Review → Interview → Decision → Enrollment.",items:["Registrar completeness review","Principal or delegate decision","Private applicant notifications and retained drafts"]},
  {title:"Attendance resolution",description:"Present/Late/Absent → Guardian Notification → Resolution → Closure.",items:["Reasoned corrections preserve history","Policy-driven escalation","Offline and version-conflict recovery"]},
  {title:"Fee collection",description:"Invoice → Reminder → Payment → Settlement → Receipt.",items:["Partial and failed payments","Approved refunds and write-offs","Idempotency and reconciliation"]},
  {title:"Transport and communication",description:"Safety and governed-delivery workflows with recipient-level state.",items:["Boarding and drop-off exceptions","Draft, review, publish, deliver, read, archive","Fallback channels and delivery retry"]},
]} />; }

export function NotificationArchitecturePage() { return <ArchitecturePage path="/product-architecture/notifications" eyebrow="Product Architecture" title="Notification patterns" description="One event architecture across toast, banner, inbox, email, push, SMS, and activity feed." icon={BellRing} sections={[
  {title:"Categories",description:"Meaning is separate from urgency.",items:["Success, Warning, Error, and Info","Approval Required and System Alert","Reminder and Escalation"]},
  {title:"Priority",description:"Impact, urgency, audience, and recovery determine priority.",items:["Low: feed or digest","Medium: durable inbox","High: prominent and SLA escalated","Critical: persistent until acknowledged and resolved"]},
  {title:"Channel selection",description:"Use the least interruptive channel that meets the delivery requirement.",items:["Toast for immediate transient feedback","Inbox for durable action","Email/push/SMS according to consent, sensitivity, and urgency"]},
  {title:"Notification state",description:"A durable notification has a stable lifecycle.",items:["Deduplicate by event and recipient","Distinguish read, acknowledged, and resolved","Track each delivery attempt independently"]},
]} />; }

export function DomainComponentsPage() { return <ArchitecturePage path="/product-architecture/domain-components" eyebrow="Product Architecture" title="Domain components" description="Reusable typed APIs encoding Munaxa’s school concepts above the primitive layer." icon={Boxes} sections={[
  {title:"Students and attendance",description:"Identity, enrollment, guardian, register, timeline, and risk components.",items:["StudentCard, StudentAvatar, StudentBadge, StudentStatus","GuardianSummary and EnrollmentStatus","AttendanceSummary, Timeline, Risk Indicator, and Class Widget"]},
  {title:"Finance",description:"Immutable financial lifecycle representations.",items:["BalanceCard and InvoiceCard","PaymentCard and FeeStatusCard","CollectionSummary and AgingCard"]},
  {title:"Transport and communication",description:"Operational safety and governed messaging.",items:["Bus, Route, Driver, Transport, and Boarding status","Announcement, Notification, Conversation, Message, and Delivery status"]},
  {title:"Reporting",description:"Ownership, parameters, metrics, freshness, and export lifecycle.",items:["ReportCard and ReportMetric","ReportFilterBar","ExportStatus and export action"]},
]} />; }

export function AIGenerationRulesPage() { return <ArchitecturePage path="/product-architecture/ai-rules" eyebrow="Product Architecture" title="AI generation rules" description="Machine-oriented constraints for safe, consistent, Arabic-first Munaxa interfaces." icon={Bot} sections={[
  {title:"Composition",description:"Start with role, decision, pattern, workflow state, locale, and device.",items:["One primary action per task context","Reuse templates and domain components","Include loading, empty, error, denied, and approval states"]},
  {title:"Permission and workflow",description:"AI cannot invent access or client-only state transitions.",items:["Apply capability plus scope","Filter sensitive data before render","Use explicit server-owned state machines"]},
  {title:"Notifications",description:"Emit from domain events and select channels by policy.",items:["Assign category and priority","Protect sensitive previews","Deduplicate and localize"]},
  {title:"Visual constraints",description:"Preserve the Munaxa enterprise identity.",items:["Semantic tokens only","Arabic-first logical RTL layout","No neon, glow, glassmorphism, or decorative dashboards"]},
]} />; }

