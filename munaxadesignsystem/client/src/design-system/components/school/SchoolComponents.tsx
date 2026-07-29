import type { ReactNode } from "react";
import { Building2, Bus, Check, ChevronsUpDown, CircleAlert, Clock3, GraduationCap, UserRound, UsersRound, WalletCards } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
const attendanceStyle: Record<AttendanceStatus, string> = { present: "bg-success/10 text-success", late: "bg-warning/10 text-warning", absent: "bg-destructive/10 text-destructive", excused: "bg-info/10 text-info" };

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return <Badge className={cn("border-0 capitalize", attendanceStyle[status])}>{status}</Badge>;
}

export function StudentAvatar({ name, src, className }: { name: string; src?: string; className?: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <Avatar className={className}><AvatarImage src={src} alt="" /><AvatarFallback aria-label={name}>{initials}</AvatarFallback></Avatar>;
}

export type PersonCardProps = { name: string; subtitle: string; meta?: string; src?: string; action?: ReactNode; icon: ReactNode };
function PersonCard({ name, subtitle, meta, src, action, icon }: PersonCardProps) {
  return <Card><CardContent className="flex items-center gap-4 pt-0"><StudentAvatar name={name} src={src} className="size-11" /><div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{name}</h3><p className="text-sm text-muted-foreground">{subtitle}</p>{meta && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{icon}{meta}</p>}</div>{action}</CardContent></Card>;
}
export function StudentCard(props: Omit<PersonCardProps, "icon">) { return <PersonCard {...props} icon={<GraduationCap className="size-3.5" aria-hidden />} />; }
export function TeacherCard(props: Omit<PersonCardProps, "icon">) { return <PersonCard {...props} icon={<UserRound className="size-3.5" aria-hidden />} />; }
export function ParentCard(props: Omit<PersonCardProps, "icon">) { return <PersonCard {...props} icon={<UsersRound className="size-3.5" aria-hidden />} />; }

export function AttendanceCard({ label, value, status, detail }: { label: string; value: string; status: AttendanceStatus; detail?: string }) {
  return <Card><CardHeader className="flex-row items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><CardTitle className="mt-2 text-3xl">{value}</CardTitle></div><AttendanceStatusBadge status={status} /></CardHeader>{detail && <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>}</Card>;
}

export type FeeStatus = "paid" | "partial" | "due" | "overdue";
export function FeeStatusCard({ title, amount, paid, dueDate, status }: { title: string; amount: string; paid: string; dueDate: string; status: FeeStatus }) {
  const Icon = status === "paid" ? Check : status === "overdue" ? CircleAlert : Clock3;
  return <Card><CardHeader className="flex-row justify-between"><div><CardTitle>{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Due {dueDate}</p></div><Icon className="size-5 text-primary" aria-hidden /></CardHeader><CardContent><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold">{amount}</dd></div><div><dt className="text-muted-foreground">Paid</dt><dd className="font-semibold">{paid}</dd></div></dl><Badge variant={status === "overdue" ? "destructive" : "secondary"} className="mt-4 capitalize">{status}</Badge></CardContent></Card>;
}

export function TransportCard({ route, stop, driver, status = "On time" }: { route: string; stop: string; driver: string; status?: string }) {
  return <Card><CardHeader className="flex-row items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Bus className="size-5" aria-hidden /></span><div><CardTitle>{route}</CardTitle><p className="text-sm text-muted-foreground">{status}</p></div></CardHeader><CardContent className="text-sm"><p>{stop}</p><p className="text-muted-foreground">Driver: {driver}</p></CardContent></Card>;
}

export function SchoolMetricCard({ label, value, trend, icon }: { label: string; value: string; trend?: string; icon?: ReactNode }) {
  return <Card><CardContent className="pt-0"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span>{icon ?? <Building2 className="size-4" aria-hidden />}</div><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>{trend && <p className="mt-2 text-xs text-muted-foreground">{trend}</p>}</CardContent></Card>;
}

export function SchoolSwitcher({ schools, value, onValueChange, ariaLabel = "Select school" }: { schools: string[]; value: string; onValueChange?: (school: string) => void; ariaLabel?: string }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button aria-label={ariaLabel} variant="outline" className="w-full justify-between"><span className="truncate">{value}</span><ChevronsUpDown className="size-4" aria-hidden /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">{schools.map((school) => <DropdownMenuItem key={school} onSelect={() => onValueChange?.(school)}>{school}{school === value && <Check className="ms-auto size-4" aria-hidden />}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

export { WalletCards };
