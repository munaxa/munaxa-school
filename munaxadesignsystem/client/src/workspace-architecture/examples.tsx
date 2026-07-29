import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { InfoGrid, StatusBadge, SummaryPanel, type TimelineItem } from "@/domain-components/shared";
import { AttendanceSummary, AttendanceTrendCard } from "@/domain-components/attendance";
import { AgingCard, CollectionSummary } from "@/domain-components/finance";
import { MessageComposer, NotificationFeed } from "@/domain-components/communication";
import { ReportInsightCard, ReportSummary } from "@/domain-components/reports";
import { RecordWorkspace, type RelatedRecord, type WorkspaceAction, type WorkspaceMetric, type WorkspaceTab } from ".";

const timeline:TimelineItem[]=[
  {id:"1",title:"Record updated",detail:"A permitted field change was saved.",time:"Today, 10:42",tone:"info"},
  {id:"2",title:"Workflow completed",detail:"The previous task moved to its resolved state.",time:"Yesterday, 15:10",tone:"success"},
];
const audit:TimelineItem[]=[
  {id:"a1",title:"Status changed",detail:"Previous: pending · New: active · Reason recorded",time:"Today, 10:42",tone:"primary"},
];
const actions=[{id:"edit",label:"Edit record",kind:"primary" as const},{id:"message",label:"Send message",kind:"secondary" as const},{id:"archive",label:"Request archival",kind:"danger" as const}];
const overview=(items:{label:string;value:ReactNode}[]) => <SummaryPanel title="Overview"><InfoGrid columns={3} items={items}/></SummaryPanel>;

function Workspace({name,subtitle,status,metrics,tabs,related,customActions=actions}:{name:string;subtitle:string;status:string;metrics:WorkspaceMetric[];tabs:WorkspaceTab[];related:RelatedRecord[];customActions?:WorkspaceAction[]}){
  return <RecordWorkspace name={name} subtitle={subtitle} status={<StatusBadge label={status} tone="success"/>} headerActions={<Button variant="outline">Open command menu</Button>} metrics={metrics} tabs={tabs} related={related} timeline={timeline} audit={audit} actions={customActions}/>;
}

export function StudentWorkspaceExample(){return <Workspace name="Lina Haddad" subtitle="Student · MUN-2048 · Grade 8A" status="Enrolled" metrics={[{label:"Attendance",value:"96.4%"},{label:"Balance",value:"$1,500"},{label:"Documents",value:"12"},{label:"Open alerts",value:"1"}]} tabs={[
  {id:"overview",label:"Overview",content:overview([{label:"Campus",value:"Main Campus"},{label:"Enrollment",value:"Active"},{label:"Class",value:"8A"}])},
  {id:"attendance",label:"Attendance",content:<AttendanceTrendCard rate={96.4} change="+1.2% this month"/>},
  {id:"finance",label:"Finance",content:overview([{label:"Outstanding",value:"$1,500"},{label:"Next due",value:"30 June"}])},
  {id:"documents",label:"Documents",content:overview([{label:"Verified",value:"10"},{label:"Pending",value:"2"}])},
  {id:"communication",label:"Communication",content:<NotificationFeed items={timeline}/>},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"p1",type:"Guardian",label:"Omar Haddad",detail:"Primary · Verified",status:<StatusBadge label="Verified" tone="success"/>},{id:"i1",type:"Invoice",label:"INV-2041",detail:"Term 2 tuition",status:<StatusBadge label="Partial" tone="warning"/>},{id:"at1",type:"Attendance alert",label:"ATT-318",detail:"Resolved yesterday",status:<StatusBadge label="Closed" tone="success"/>},{id:"m1",type:"Message",label:"MSG-804",detail:"Parent acknowledgement"}]}/>;}

export function TeacherWorkspaceExample(){return <Workspace name="Noura Saleh" subtitle="Teacher · Mathematics · Grades 7–9" status="Active" metrics={[{label:"Classes",value:"5"},{label:"Students",value:"126"},{label:"Workload",value:"18h"},{label:"Attendance due",value:"2"}]} tabs={[
  {id:"overview",label:"Overview",content:overview([{label:"Department",value:"Mathematics"},{label:"Campus",value:"Main Campus"},{label:"Assignment",value:"Grades 7–9"}])},
  {id:"schedule",label:"Schedule",content:overview([{label:"Next class",value:"Grade 8A · 10:00"},{label:"Room",value:"204"}])},
  {id:"classes",label:"Classes",content:overview([{label:"Assigned classes",value:"5"},{label:"Students",value:"126"}])},
  {id:"attendance",label:"Attendance",content:<AttendanceSummary present={19} late={1} absent={0}/>},
  {id:"communication",label:"Communication",content:<NotificationFeed items={timeline}/>},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"c1",type:"Class",label:"Grade 8A",detail:"30 students"},{id:"c2",type:"Class",label:"Grade 7B",detail:"28 students"},{id:"msg",type:"Conversation",label:"Academic leadership",detail:"Last message today"}]}/>;}

export function ParentWorkspaceExample(){return <Workspace name="Omar Haddad" subtitle="Parent · Verified primary guardian" status="Active" metrics={[{label:"Children",value:"2"},{label:"Balance",value:"$1,500"},{label:"Unread",value:"3"},{label:"Forms due",value:"1"}]} tabs={[
  {id:"overview",label:"Overview",content:overview([{label:"Preferred channel",value:"Email"},{label:"Language",value:"Arabic"},{label:"Relationship",value:"Primary guardian"}])},
  {id:"children",label:"Children",content:overview([{label:"Lina Haddad",value:"Grade 8"},{label:"Sami Haddad",value:"Grade 4"}])},
  {id:"finance",label:"Finance",content:overview([{label:"Outstanding",value:"$1,500"},{label:"Last payment",value:"1 June"}])},
  {id:"communication",label:"Communication",content:<MessageComposer/>},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"s1",type:"Child",label:"Lina Haddad",detail:"Grade 8 · Active"},{id:"s2",type:"Child",label:"Sami Haddad",detail:"Grade 4 · Active"},{id:"pay",type:"Payment",label:"PAY-8821",detail:"Settled 1 June"}]}/>;}

export function FinanceWorkspaceExample(){return <Workspace name="Haddad family account" subtitle="Account · ACC-1048 · USD" status="Active" metrics={[{label:"Balance",value:"$1,500"},{label:"Collected",value:"$8,500"},{label:"Open invoices",value:"2"},{label:"Overdue",value:"$0"}]} tabs={[
  {id:"overview",label:"Overview",content:<CollectionSummary collected="$8,500" billed="$10,000" rate="85%"/>},
  {id:"invoices",label:"Invoices",content:<AgingCard current="$1,500" days30="$0" days60="$0" days90="$0"/>},
  {id:"payments",label:"Payments",content:overview([{label:"Last payment",value:"$3,500"},{label:"Settlement",value:"Settled"}])},
  {id:"statements",label:"Statements",content:overview([{label:"Current term",value:"Ready"},{label:"Previous term",value:"Ready"}])},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"s1",type:"Student",label:"Lina Haddad",detail:"Grade 8"},{id:"p1",type:"Parent",label:"Omar Haddad",detail:"Primary payer"},{id:"i1",type:"Invoice",label:"INV-2041",detail:"Partial",status:<StatusBadge label="Partial" tone="warning"/>}]} customActions={[{id:"payment",label:"Record payment",kind:"primary"},{id:"reminder",label:"Send reminder",kind:"secondary"},{id:"writeoff",label:"Request write-off",kind:"approval"}]}/>}

export function AttendanceWorkspaceExample(){return <Workspace name="Grade 8A register" subtitle="Attendance record · 18 June · Morning" status="Submitted" metrics={[{label:"Present",value:"27"},{label:"Late",value:"1"},{label:"Absent",value:"2"},{label:"Exceptions",value:"1"}]} tabs={[
  {id:"overview",label:"Overview",content:<AttendanceSummary present={27} late={1} absent={2}/>},
  {id:"exceptions",label:"Exceptions",content:overview([{label:"Guardian response",value:"Pending"},{label:"SLA",value:"2 hours"}])},
  {id:"notifications",label:"Notifications",content:<NotificationFeed items={timeline}/>},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"s1",type:"Student",label:"Maya Khalil",detail:"Absent · Guardian notified"},{id:"t1",type:"Teacher",label:"Noura Saleh",detail:"Register owner"},{id:"class",type:"Class",label:"Grade 8A",detail:"30 students"}]} customActions={[{id:"resolve",label:"Resolve exception",kind:"primary"},{id:"correct",label:"Request correction",kind:"approval"}]}/>}

export function CommunicationWorkspaceExample(){return <Workspace name="Term calendar update" subtitle="Announcement · All parents · ANN-204" status="Review" metrics={[{label:"Audience",value:"1,242"},{label:"Delivered",value:"—"},{label:"Read",value:"—"},{label:"Failed",value:"—"}]} tabs={[
  {id:"overview",label:"Overview",content:overview([{label:"Owner",value:"School Operations"},{label:"Language",value:"Arabic + English"},{label:"Schedule",value:"After approval"}])},
  {id:"announcements",label:"Announcements",content:<MessageComposer label="Announcement content"/>},
  {id:"messages",label:"Messages",content:<NotificationFeed items={timeline}/>},
  {id:"templates",label:"Templates",content:overview([{label:"Template",value:"Calendar update"},{label:"Version",value:"3"}])},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"seg",type:"Audience",label:"All parents",detail:"1,242 recipients"},{id:"tpl",type:"Template",label:"Calendar update",detail:"Version 3"},{id:"appr",type:"Approval",label:"APR-881",detail:"Pending Principal"}]} customActions={[{id:"approve",label:"Approve and schedule",kind:"approval"},{id:"changes",label:"Request changes",kind:"secondary"},{id:"cancel",label:"Cancel draft",kind:"danger"}]}/>}

export function ReportsWorkspaceExample(){return <Workspace name="Monthly attendance" subtitle="Report · REP-104 · Operations" status="Ready" metrics={[{label:"Attendance",value:"94.7%"},{label:"Students",value:"1,842"},{label:"Campuses",value:"2"},{label:"Updated",value:"10m"}]} tabs={[
  {id:"overview",label:"Overview",content:<ReportSummary title="Report scope" items={[{label:"Period",value:"June 2026"},{label:"Campus",value:"All campuses"},{label:"Owner",value:"Operations"}]}/>},
  {id:"results",label:"Results",content:<ReportInsightCard title="Attendance signal" insight="Grade 8B improved 2.1% after intervention."/>},
  {id:"schedule",label:"Schedule",content:overview([{label:"Frequency",value:"Monthly"},{label:"Recipients",value:"Leadership"}])},
  {id:"exports",label:"Exports",content:overview([{label:"Latest",value:"Ready"},{label:"Format",value:"PDF + CSV"}])},
  {id:"activity",label:"Activity",content:<NotificationFeed items={timeline}/>},
]} related={[{id:"sch",type:"School",label:"Munaxa International School",detail:"Primary scope"},{id:"exp",type:"Export",label:"EXP-442",detail:"Ready"},{id:"sched",type:"Schedule",label:"Monthly leadership",detail:"Next: 1 July"}]} customActions={[{id:"run",label:"Run report",kind:"primary"},{id:"export",label:"Export",kind:"secondary"},{id:"schedule",label:"Edit schedule",kind:"secondary"}]}/>}

export const workspaceExamples=[
  {id:"student",label:"Student",Component:StudentWorkspaceExample},
  {id:"teacher",label:"Teacher",Component:TeacherWorkspaceExample},
  {id:"parent",label:"Parent",Component:ParentWorkspaceExample},
  {id:"finance",label:"Finance",Component:FinanceWorkspaceExample},
  {id:"attendance",label:"Attendance",Component:AttendanceWorkspaceExample},
  {id:"communication",label:"Communication",Component:CommunicationWorkspaceExample},
  {id:"reports",label:"Reports",Component:ReportsWorkspaceExample},
] as const;
