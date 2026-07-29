import type { ReactNode } from "react";
import { FileText, Phone, ShieldAlert, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactCard, DocumentViewer, EntityAvatar, IdentityHeader, InfoGrid, MetricCard, QuickActionBar, StatusBadge, SummaryPanel, TagGroup, Timeline, type InfoItem, type QuickAction, type TimelineItem } from "../shared";

export const StudentAvatar=EntityAvatar;
export type StudentState="active"|"pending"|"withdrawn"|"archived";
const tone={active:"success",pending:"warning",withdrawn:"neutral",archived:"neutral"} as const;
export function StudentStatusBadge({status}:{status:StudentState}){return <StatusBadge label={status} tone={tone[status]}/>;}
export function StudentCard({name,subtitle,status="active",src,action}:{name:string;subtitle:string;status?:StudentState;src?:string;action?:ReactNode}){return <Card><CardContent className="flex items-center gap-4 pt-0"><EntityAvatar name={name} src={src}/><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div><StudentStatusBadge status={status}/>{action}</CardContent></Card>;}
export function StudentProfileHeader(props:{name:string;subtitle:string;src?:string;status?:StudentState;actions?:ReactNode}){return <IdentityHeader name={props.name} subtitle={props.subtitle} src={props.src} status={<StudentStatusBadge status={props.status??"active"}/>} actions={props.actions}/>;}
export function StudentTimeline({items}:{items:TimelineItem[]}){return <Timeline items={items} empty="No student activity"/>;}
export function StudentMetrics({items}:{items:{label:string;value:string;detail?:string}[]}){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(x=><MetricCard key={x.label}{...x}/>)}</div>;}
export type EnrollmentState="inquiry"|"applied"|"review"|"enrolled"|"withdrawn";
export function EnrollmentStatus({status}:{status:EnrollmentState}){const t=status==="enrolled"?"success":status==="review"?"warning":status==="applied"?"info":"neutral";return <StatusBadge label={status} tone={t}/>;}
export function GuardianSummary({name,relationship,phone,verified=false}:{name:string;relationship:string;phone?:string;verified?:boolean}){return <ContactCard title={relationship} name={name} phone={phone} status={<StatusBadge label={verified?"Verified":"Unverified"} tone={verified?"success":"warning"}/>}/>}
export function StudentQuickActions({actions}:{actions:QuickAction[]}){return <QuickActionBar actions={actions} label="Student quick actions"/>;}
export function StudentIdentityPanel({items}:{items:InfoItem[]}){return <SummaryPanel title="Student identity"><InfoGrid items={items}/></SummaryPanel>;}
export function StudentInfoGrid({items}:{items:InfoItem[]}){return <InfoGrid items={items} columns={3}/>;}
export function StudentContactPanel(props:{name:string;email?:string;phone?:string}){return <ContactCard title="Student contact" {...props}/>}
export function StudentEmergencyContact(props:{name:string;phone:string;relationship?:string}){return <ContactCard title={props.relationship??"Emergency contact"} name={props.name} phone={props.phone} status={<ShieldAlert className="size-4 text-warning" aria-hidden/>}/>}
export function StudentDocumentsPanel({documents}:{documents:{name:string;type:string;status?:ReactNode}[]}){return <SummaryPanel title="Documents"><div className="space-y-2">{documents.map(d=><DocumentViewer key={d.name}{...d}/>)}</div></SummaryPanel>;}
export function StudentTags({tags}:{tags:string[]}){return <TagGroup tags={tags} label="Student tags"/>;}
export function StudentSummaryCard({name,id,grade,status="active"}:{name:string;id:string;grade:string;status?:StudentState}){return <SummaryPanel title={name} description={id} action={<StudentStatusBadge status={status}/>}><InfoGrid items={[{label:"Grade",value:grade},{label:"Student ID",value:<span dir="ltr">{id}</span>}]}/></SummaryPanel>;}
export { FileText, Phone, UserRound };

