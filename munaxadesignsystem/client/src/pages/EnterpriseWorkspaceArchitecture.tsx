import { useMemo, useState } from "react";
import { Activity, GitBranch, History, Link2, Search, ShieldCheck, Workflow } from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UniversalSearch } from "@/workspace-architecture";
import { workspaceExamples } from "@/workspace-architecture/examples";

const patterns=[
  {title:"Record Workspace",description:"Header, metrics, tabs, related records, timeline, actions, and audit.",icon:Workflow},
  {title:"Timeline",description:"Chronological business history with actors, groups, filters, and recovery.",icon:History},
  {title:"Related Records",description:"Typed relationships and cross-navigation without duplicated data.",icon:Link2},
  {title:"Activity Feed",description:"Operational awareness distinct from immutable compliance evidence.",icon:Activity},
  {title:"Action Panel",description:"Permission- and state-aware primary, secondary, dangerous, and approval actions.",icon:GitBranch},
  {title:"Audit Trail",description:"Immutable actor, timestamp, diff, reason, and approval evidence.",icon:ShieldCheck},
  {title:"Universal Search",description:"Authorized cross-domain record discovery with keyboard navigation.",icon:Search},
];
const allResults=[
  {id:"s1",type:"Student",label:"Lina Haddad",detail:"MUN-2048 · Grade 8A",status:"Active"},
  {id:"t1",type:"Teacher",label:"Noura Saleh",detail:"Mathematics · Main Campus",status:"Active"},
  {id:"p1",type:"Parent",label:"Omar Haddad",detail:"Guardian of Lina and Sami",status:"Verified"},
  {id:"i1",type:"Invoice",label:"INV-2041",detail:"Haddad family · $5,000",status:"Partial"},
];

export default function EnterpriseWorkspaceArchitecture(){
  const [query,setQuery]=useState("");
  const results=useMemo(()=>query?allResults.filter(r=>(r.label+" "+r.detail+" "+r.type).toLowerCase().includes(query.toLowerCase())):[],[query]);
  return <Layout currentPage="/enterprise-workspaces"><div className="mx-auto max-w-7xl space-y-10 px-6 py-12"><header><p className="text-sm font-medium text-primary">Product Operating System</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Enterprise Workspace Architecture</h1><p className="mt-3 max-w-3xl text-lg text-muted-foreground">Record-centric workspaces connect identity, workflow state, relationships, actions, history, permissions, and audit evidence.</p></header>
    <nav aria-label="Architecture cross-links" className="flex flex-wrap gap-2">{[{href:"/school-domain",label:"Domain Architecture"},{href:"/patterns",label:"Patterns"},{href:"/product-architecture/permissions",label:"Permissions"},{href:"/product-architecture/workflows",label:"Workflows"}].map(x=><Link key={x.href} href={x.href}><a className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">{x.label}</a></Link>)}</nav>
    <Tabs defaultValue="patterns"><TabsList><TabsTrigger value="patterns">Architecture patterns</TabsTrigger><TabsTrigger value="examples">Workspace examples</TabsTrigger><TabsTrigger value="search">Universal search</TabsTrigger></TabsList>
      <TabsContent value="patterns" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{patterns.map(({title,description,icon:Icon})=><Card key={title}><CardHeader className="flex-row items-start justify-between"><CardTitle>{title}</CardTitle><Icon className="size-5 text-primary" aria-hidden/></CardHeader><CardContent><p className="text-sm text-muted-foreground">{description}</p></CardContent></Card>)}</TabsContent>
      <TabsContent value="examples" className="mt-6"><Tabs defaultValue={workspaceExamples[0].id}><TabsList className="flex h-auto flex-wrap justify-start">{workspaceExamples.map(x=><TabsTrigger key={x.id} value={x.id}>{x.label}</TabsTrigger>)}</TabsList>{workspaceExamples.map(({id,Component})=><TabsContent key={id} value={id} className="mt-6"><Component/></TabsContent>)}</Tabs></TabsContent>
      <TabsContent value="search" className="mt-6"><Card><CardHeader><CardTitle>Search authorized records</CardTitle></CardHeader><CardContent><UniversalSearch query={query} onQueryChange={setQuery} results={results} recent={["Lina Haddad","INV-2041","Grade 8A"]}/></CardContent></Card></TabsContent>
    </Tabs>
  </div></Layout>;
}

