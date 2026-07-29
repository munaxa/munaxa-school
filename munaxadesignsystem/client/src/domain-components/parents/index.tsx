import type { ReactNode } from "react";
import { MessageSquare, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactCard, EntityAvatar, IdentityHeader, InfoGrid, MetricCard, QuickActionBar, StatusBadge, SummaryPanel, type QuickAction } from "../shared";

export type ParentState="active"|"pending-verification"|"restricted";
export function ParentStatusBadge({status}:{status:ParentState}){return <StatusBadge label={status} tone={status==="active"?"success":status==="pending-verification"?"warning":"danger"}/>;}
export function ParentCard({name,relationship,status="active",src}:{name:string;relationship:string;status?:ParentState;src?:string}){return <Card><CardContent className="flex items-center gap-4 pt-0"><EntityAvatar name={name} src={src}/><div className="flex-1"><h3 className="font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{relationship}</p></div><ParentStatusBadge status={status}/></CardContent></Card>;}
export function ParentProfileHeader(props:{name:string;subtitle:string;src?:string;status?:ParentState;actions?:ReactNode}){return <IdentityHeader name={props.name} subtitle={props.subtitle} src={props.src} status={<ParentStatusBadge status={props.status??"active"}/>} actions={props.actions}/>;}
export function ParentContactCard(props:{name:string;email?:string;phone?:string}){return <ContactCard title="Parent contact" {...props}/>}
export function GuardianRelationshipCard({guardian,student,relationship,verified=false}:{guardian:string;student:string;relationship:string;verified?:boolean}){return <SummaryPanel title={guardian} description={relationship} action={<StatusBadge label={verified?"Verified":"Unverified"} tone={verified?"success":"warning"}/>}><p className="text-sm text-muted-foreground">Linked student: <span className="font-medium text-foreground">{student}</span></p></SummaryPanel>;}
export function ParentCommunicationCard({lastContact,channel,unread=0}:{lastContact:string;channel:string;unread?:number}){return <SummaryPanel title="Communication" action={<MessageSquare className="size-5 text-primary" aria-hidden/>}><InfoGrid items={[{label:"Last contact",value:lastContact},{label:"Preferred channel",value:channel},{label:"Unread",value:unread}]}/></SummaryPanel>;}
export function ParentChildrenList({children}:{children:{name:string;grade:string;status?:ReactNode}[]}){return <SummaryPanel title="Children"><ul className="divide-y">{children.map(x=><li key={x.name} className="flex items-center gap-3 py-3"><EntityAvatar name={x.name} size="sm"/><div className="flex-1"><p className="text-sm font-medium">{x.name}</p><p className="text-xs text-muted-foreground">{x.grade}</p></div>{x.status}</li>)}</ul></SummaryPanel>;}
export function ParentSummaryCard({name,childrenCount,relationship}:{name:string;childrenCount:number;relationship:string}){return <SummaryPanel title={name} description={relationship}><InfoGrid items={[{label:"Linked children",value:childrenCount}]}/></SummaryPanel>;}
export function ParentQuickActions({actions}:{actions:QuickAction[]}){return <QuickActionBar actions={actions} label="Parent quick actions"/>;}
export function ParentMetrics({items}:{items:{label:string;value:string;detail?:string}[]}){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(x=><MetricCard key={x.label}{...x}/>)}</div>;}
export { Users };
