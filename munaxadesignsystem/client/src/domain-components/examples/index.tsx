import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as Students from "../students";
import * as Teachers from "../teachers";
import * as Parents from "../parents";
import * as Attendance from "../attendance";
import * as Finance from "../finance";
import * as Transport from "../transport";
import * as Communication from "../communication";
import * as Reports from "../reports";

const metrics=[{label:"Attendance",value:"96.4%",detail:"Current term"},{label:"Open tasks",value:"3"},{label:"Documents",value:"12"},{label:"Messages",value:"2"}];

export function StudentProfileExample(){
  return <div className="space-y-6"><Students.StudentProfileHeader name="Lina Haddad" subtitle="Grade 8 · MUN-2048" actions={<Students.StudentQuickActions actions={[{id:"message",label:"Message"},{id:"edit",label:"Edit profile"}]}/>}/><Students.StudentMetrics items={metrics}/><div className="grid gap-6 lg:grid-cols-2"><Students.StudentIdentityPanel items={[{label:"Student ID",value:<span dir="ltr">MUN-2048</span>},{label:"Grade",value:"8A"},{label:"Enrollment",value:<Students.EnrollmentStatus status="enrolled"/>},{label:"Campus",value:"Main Campus"}]}/><Students.GuardianSummary name="Omar Haddad" relationship="Primary guardian" phone="+962 7 9000 0000" verified/></div><Students.StudentDocumentsPanel documents={[{name:"Birth certificate",type:"PDF",status:<Students.StudentStatusBadge status="active"/>},{name:"Previous transcript",type:"PDF"}]}/></div>;
}

export function StudentListExample(){
  return <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">Students</h2><p className="text-sm text-muted-foreground">1,842 active records</p></div><Button>Add student</Button></header><Input aria-label="Search students" placeholder="Search by name or ID"/><div className="grid gap-4 md:grid-cols-2"><Students.StudentCard name="Lina Haddad" subtitle="Grade 8 · MUN-2048"/><Students.StudentCard name="Omar Saleh" subtitle="Grade 6 · MUN-1932" status="pending"/></div></div>;
}

export function AttendanceDashboardExample(){
  return <div className="space-y-6"><header><h2 className="text-2xl font-semibold">Attendance dashboard</h2><p className="text-sm text-muted-foreground">Thursday, 18 June · Main Campus</p></header><Attendance.AttendanceSummary present={1746} late={32} absent={64} excused={18}/><div className="grid gap-6 lg:grid-cols-2"><Attendance.AttendanceTrendCard rate={94.7} change="+0.8% this week"/><Attendance.AttendanceClassWidget name="Grade 8A" marked={27} total={30}/></div><Attendance.AttendanceExceptionCard title="Guardian response overdue" description="Three absence cases exceeded the response SLA." action={<Button size="sm">Review cases</Button>}/></div>;
}

export function TeacherProfileExample(){
  return <div className="space-y-6"><Teachers.TeacherProfileHeader name="Noura Saleh" subtitle="Mathematics · Grades 7–9" actions={<Teachers.TeacherQuickActions actions={[{id:"message",label:"Message"},{id:"schedule",label:"View schedule"}]}/>}/><Teachers.TeacherMetrics items={[{label:"Classes",value:"5"},{label:"Students",value:"126"},{label:"To grade",value:"18"},{label:"Attendance due",value:"2"}]}/><div className="grid gap-6 lg:grid-cols-2"><Teachers.TeacherScheduleCard title="Today" items={[{time:"08:00",label:"Grade 8A · Mathematics"},{time:"10:00",label:"Grade 7B · Mathematics"}]}/><Teachers.TeacherWorkloadCard lessons={24} students={126} hours={18}/></div></div>;
}

export function FinanceDashboardExample(){
  return <div className="space-y-6"><header className="flex items-end justify-between"><div><h2 className="text-2xl font-semibold">Finance dashboard</h2><p className="text-sm text-muted-foreground">Term 2 · All campuses</p></div><Finance.FinanceQuickActions actions={[{id:"invoice",label:"Create invoice"},{id:"payment",label:"Record payment"}]}/></header><Finance.FinanceMetrics items={[{label:"Collected",value:"$1.42m"},{label:"Outstanding",value:"$128k"},{label:"Collection rate",value:"91%"},{label:"Overdue accounts",value:"47"}]}/><div className="grid gap-6 lg:grid-cols-2"><Finance.CollectionSummary collected="$1.42m" billed="$1.56m" rate="91%"/><Finance.AgingCard current="$82k" days30="$24k" days60="$14k" days90="$8k"/></div></div>;
}

export function ParentProfileExample(){
  return <div className="space-y-6"><Parents.ParentProfileHeader name="Omar Haddad" subtitle="Primary guardian · Verified" actions={<Parents.ParentQuickActions actions={[{id:"message",label:"Message"},{id:"statement",label:"View statement"}]}/>}/><Parents.ParentMetrics items={[{label:"Linked children",value:"2"},{label:"Unread messages",value:"3"},{label:"Forms due",value:"1"},{label:"Balance",value:"$1,500"}]}/><div className="grid gap-6 lg:grid-cols-2"><Parents.ParentContactCard name="Omar Haddad" email="omar@example.com" phone="+962 7 9000 0000"/><Parents.ParentChildrenList children={[{name:"Lina Haddad",grade:"Grade 8"},{name:"Sami Haddad",grade:"Grade 4"}]}/></div></div>;
}

export function ReportsDashboardExample(){
  return <div className="space-y-6"><header><h2 className="text-2xl font-semibold">Reports dashboard</h2><p className="text-sm text-muted-foreground">Trusted analytics with ownership and freshness.</p></header><Reports.ReportFilterBar><Select><SelectTrigger className="w-44"><SelectValue placeholder="Campus"/></SelectTrigger><SelectContent><SelectItem value="all">All campuses</SelectItem></SelectContent></Select></Reports.ReportFilterBar><div className="grid gap-4 md:grid-cols-2"><Reports.ReportCard title="Monthly attendance" owner="Operations" updated="10 minutes ago"/><Reports.ReportScheduleCard name="Fee aging" schedule="Monthly" nextRun="1 July, 08:00"/></div><Reports.ReportInsightCard title="Attendance signal" insight="Grade 8B improved 2.1% after the intervention workflow."/></div>;
}

export function TransportDashboardExample(){
  return <div className="space-y-6"><header><h2 className="text-2xl font-semibold">Transport dashboard</h2><p className="text-sm text-muted-foreground">Live routes, vehicles, boarding, and exceptions.</p></header><Transport.TransportMetrics items={[{label:"Active routes",value:"18"},{label:"Students assigned",value:"624"},{label:"On time",value:"16"},{label:"Exceptions",value:"2"}]}/><div className="grid gap-4 md:grid-cols-2"><Transport.BusCard number="Bus 12" plate="34-ABC" capacity="42" status="in-transit"/><Transport.RouteCard name="North District" stops={8} status="delayed"/><Transport.TripCard route="Route 7 · Morning" time="07:10" passengers={34} status="boarding"/><Transport.DriverCard name="Ahmad Khalil" vehicle="Bus 12" phone="+962 7 9111 1111"/></div></div>;
}

export function CommunicationCenterExample(){
  return <div className="space-y-6"><header><h2 className="text-2xl font-semibold">Communication center</h2><p className="text-sm text-muted-foreground">Governed publishing and recipient-level delivery.</p></header><Communication.CommunicationMetrics items={[{label:"Delivered",value:"2,418"},{label:"Read",value:"86%"},{label:"Failed",value:"12"},{label:"Approvals",value:"3"}]}/><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4"><Communication.AnnouncementCard title="Term calendar update" audience="All parents" status="review" excerpt="Updated examination and holiday dates."/><Communication.ConversationCard participant="Omar Haddad" preview="Thank you for the update." unread={2} time="10:42"/></div><Communication.MessageComposer label="New message"/></div></div>;
}

export const domainExamples=[
  {id:"student-profile",label:"Student Profile",Component:StudentProfileExample},
  {id:"student-list",label:"Student List",Component:StudentListExample},
  {id:"attendance",label:"Attendance Dashboard",Component:AttendanceDashboardExample},
  {id:"teacher",label:"Teacher Profile",Component:TeacherProfileExample},
  {id:"finance",label:"Finance Dashboard",Component:FinanceDashboardExample},
  {id:"parent",label:"Parent Profile",Component:ParentProfileExample},
  {id:"reports",label:"Reports Dashboard",Component:ReportsDashboardExample},
  {id:"transport",label:"Transport Dashboard",Component:TransportDashboardExample},
  {id:"communication",label:"Communication Center",Component:CommunicationCenterExample},
] as const;

