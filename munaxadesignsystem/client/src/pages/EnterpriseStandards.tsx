import { useMemo, useState } from "react";
import { BookOpenText, CheckCircle2, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enterpriseStandards } from "@/enterprise-standards/registry";

export default function EnterpriseStandards(){
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?enterpriseStandards.filter(s=>(s.title+" "+s.arabicTitle+" "+s.summary+" "+s.keywords.join(" ")).toLowerCase().includes(q)):enterpriseStandards},[query]);
  return <Layout currentPage="/enterprise-standards"><div className="mx-auto max-w-7xl space-y-10 px-6 py-12"><header><p className="text-sm font-medium text-primary">Enterprise Product Design System</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Enterprise Standards</h1><p className="mt-3 max-w-3xl text-lg text-muted-foreground">Governance, content, analytics, search, tenant context, compliance, and documentation contracts for operating Munaxa across thousands of schools.</p></header>
    <label className="relative block max-w-2xl"><span className="sr-only">Search enterprise standards</span><Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden/><Input className="ps-9" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search governance, content, charts, tenant context, audit…"/></label>
    <section aria-label="Enterprise standards" aria-live="polite" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map(standard=><Card key={standard.id}><CardHeader className="flex-row items-start justify-between"><div><CardTitle>{standard.title}</CardTitle><p lang="ar" dir="rtl" className="mt-1 text-sm text-muted-foreground">{standard.arabicTitle}</p></div><BookOpenText className="size-5 text-primary" aria-hidden/></CardHeader><CardContent><p className="text-sm text-muted-foreground">{standard.summary}</p><div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary"><CheckCircle2 aria-hidden/>Stable</Badge><Badge variant="outline">{standard.owner}</Badge></div><dl className="mt-4 space-y-2 text-xs"><div><dt className="text-muted-foreground">Canonical document</dt><dd className="font-mono">{standard.document}</dd></div><div><dt className="text-muted-foreground">Last reviewed</dt><dd>{standard.lastReviewed}</dd></div></dl></CardContent></Card>)}</section>
    {filtered.length===0&&<p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No standards match this search. Try a domain, workflow, or component term.</p>}
  </div></Layout>;
}

