import type { ReactNode } from "react";
import { BookOpen, CalendarDays, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ContactCard, EntityAvatar, IdentityHeader, InfoGrid, MetricCard, QuickActionBar, StatusBadge, SummaryPanel, TagGroup, Timeline, type InfoItem, type QuickAction, type TimelineItem } from "../shared";

export const TeacherAvatar=EntityAvatar;
export type TeacherState="active"|"on-leave"|"inactive";
export function TeacherStatusBadge({status}:{status:TeacherState}){return <StatusBadge label={status} tone={status==="active"?"success":status==="on-leave"?"warning":"neutral"}/>;}
export function TeacherCard({name,subtitle,status="active",src}:{name:string;subtitle:string;status?:TeacherState;src?:string}){return <Card><CardContent className="flex items-center gap-4 pt-0"><EntityAvatar name={name} src={src}/><div className="min-w-0 flex-1"><h3 className="font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{subtitle}</p></div><TeacherStatusBadge status={status}/></CardContent></Card>;}
export function TeacherProfileHeader(props:{name:string;subtitle:string;src?:string;status?:TeacherState;actions?:ReactNode}){return <IdentityHeader name={props.name} subtitle={props.subtitle} src={props.src} status={<TeacherStatusBadge status={props.status??"active"}/>} actions={props.actions}/>;}
export function TeacherScheduleCard({title,items}:{title:string;items:{time:string;label:string}[]}){return <SummaryPanel title={title}><ol className="space-y-2">{items.map(x=><li key={x.time+x.label} className="flex gap-3 rounded-lg bg-muted/40 p-3"><time className="font-mono text-sm text-primary">{x.time}</time><span className="text-sm">{x.label}</span></li>)}</ol></SummaryPanel>;}
export function TeacherWorkloadCard({lessons,students,hours}:{lessons:number;students:number;hours:number}){return <SummaryPanel title="Workload"><InfoGrid columns={3} items={[{label:"Lessons",value:lessons},{label:"Students",value:students},{label:"Hours",value:hours}]}/></SummaryPanel>;}
export function TeacherSummaryCard({name,department,subjects}:{name:string;department:string;subjects:string[]}){return <SummaryPanel title={name} description={department}><TagGroup tags={subjects} label="Subjects"/></SummaryPanel>;}
export function TeacherContactPanel(props:{name:string;email?:string;phone?:string}){return <ContactCard title="Teacher contact" {...props}/>}
export function TeacherSubjectsPanel({subjects}:{subjects:string[]}){return <SummaryPanel title="Subjects"><TagGroup tags={subjects}/></SummaryPanel>;}
export function TeacherAttendanceCard({rate,absences}:{rate:string;absences:number}){return <SummaryPanel title="Teacher attendance"><InfoGrid items={[{label:"Attendance rate",value:rate},{label:"Absences",value:absences}]}/></SummaryPanel>;}
export function TeacherTimeline({items}:{items:TimelineItem[]}){return <Timeline items={items} empty="No teacher activity"/>;}
export function TeacherQuickActions({actions}:{actions:QuickAction[]}){return <QuickActionBar actions={actions} label="Teacher quick actions"/>;}
export function TeacherMetrics({items}:{items:{label:string;value:string;detail?:string}[]}){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(x=><MetricCard key={x.label}{...x}/>)}</div>;}
export function TeacherIdentityPanel({items}:{items:InfoItem[]}){return <SummaryPanel title="Teacher identity"><InfoGrid items={items}/></SummaryPanel>;}
export { BookOpen, CalendarDays, Clock3 };
