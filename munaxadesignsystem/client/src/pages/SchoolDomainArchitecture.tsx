import { ArrowRight, BellRing, Bot, Component, GitBranch, LayoutDashboard, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { domainExamples } from "@/domain-components/examples";

const domains=[
  {name:"Students",count:16,description:"Identity, enrollment, guardians, documents, and student context."},
  {name:"Teachers",count:14,description:"Teaching identity, schedule, workload, subjects, attendance, and activity."},
  {name:"Parents",count:10,description:"Guardian relationships, linked children, contact, and communication."},
  {name:"Attendance",count:13,description:"Registers, status, trends, risk, exceptions, heatmaps, and actions."},
  {name:"Finance",count:13,description:"Balances, invoices, payments, receipts, aging, and collection."},
  {name:"Transport",count:10,description:"Vehicles, routes, drivers, trips, boarding, and safety status."},
  {name:"Communication",count:10,description:"Announcements, notifications, conversations, delivery, and composition."},
  {name:"Reports",count:10,description:"Metrics, filters, summaries, schedules, insights, trends, and exports."},
  {name:"Shared",count:14,description:"Identity, status, timelines, metrics, actions, summaries, and audit."},
];
const crossLinks=[
  {href:"/patterns",label:"Patterns",icon:Workflow},
  {href:"/templates",label:"Templates",icon:LayoutDashboard},
  {href:"/product-architecture/permissions",label:"Permissions",icon:ShieldCheck},
  {href:"/product-architecture/workflows",label:"Workflows",icon:GitBranch},
  {href:"/product-architecture/notifications",label:"Notifications",icon:BellRing},
  {href:"/product-architecture/ai-rules",label:"AI Rules",icon:Bot},
];

export default function SchoolDomainArchitecture(){
  return <Layout currentPage="/school-domain"><div className="mx-auto max-w-7xl space-y-10 px-6 py-12"><header><p className="text-sm font-medium text-primary">School Operating System Design Platform</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">School Domain Architecture</h1><p className="mt-3 max-w-3xl text-lg text-muted-foreground">Business-level components and complete module examples for consistent human- and AI-authored Munaxa products.</p></header>
    <nav aria-label="Related architecture" className="flex flex-wrap gap-2">{crossLinks.map(({href,label,icon:Icon})=><Link key={href} href={href}><a className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"><Icon className="size-4" aria-hidden/>{label}<ArrowRight className="size-3.5" aria-hidden/></a></Link>)}</nav>
    <Tabs defaultValue="catalog"><TabsList><TabsTrigger value="catalog">Domain catalog</TabsTrigger><TabsTrigger value="examples">Complete examples</TabsTrigger><TabsTrigger value="rules">Composition rules</TabsTrigger></TabsList>
      <TabsContent value="catalog" className="mt-6"><section aria-label="Domain catalog" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{domains.map(domain=><Card key={domain.name}><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{domain.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{domain.count} components</p></div><Component className="size-5 text-primary" aria-hidden/></CardHeader><CardContent><p className="text-sm text-muted-foreground">{domain.description}</p></CardContent></Card>)}</section></TabsContent>
      <TabsContent value="examples" className="mt-6"><Tabs defaultValue={domainExamples[0].id}><TabsList className="flex h-auto flex-wrap justify-start">{domainExamples.map(example=><TabsTrigger key={example.id} value={example.id}>{example.label}</TabsTrigger>)}</TabsList>{domainExamples.map(({id,Component:Example})=><TabsContent key={id} value={id} className="mt-6 rounded-xl border bg-background p-6"><Example/></TabsContent>)}</Tabs></TabsContent>
      <TabsContent value="rules" className="mt-6 grid gap-5 md:grid-cols-2"><Card><CardHeader><CardTitle>Composition hierarchy</CardTitle></CardHeader><CardContent><ol className="list-decimal space-y-2 ps-5 text-sm text-muted-foreground"><li>Pattern defines page structure.</li><li>Permission and scope filter data and actions.</li><li>Domain components express school concepts.</li><li>Shared components provide common composition.</li><li>Primitives and tokens provide interaction and visual consistency.</li></ol></CardContent></Card><Card><CardHeader><CardTitle>Release requirements</CardTitle></CardHeader><CardContent><ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground"><li>Workflow state and recovery are explicit.</li><li>Notifications come from domain events.</li><li>Keyboard, screen reader, zoom, dark, and RTL states pass review.</li><li>No copied component markup or raw visual values.</li></ul></CardContent></Card></TabsContent>
    </Tabs>
  </div></Layout>;
}
