import { ShieldCheck, UserRound } from "lucide-react";
import { StudentAvatar as BaseStudentAvatar } from "../school";
import { DomainStatus, DomainTimeline, EntityCard, type TimelineEvent, type Tone } from "./shared";

export const StudentAvatar = BaseStudentAvatar;
export function StudentBadge({ label }: { label: string }) { return <DomainStatus label={label} tone="primary" />; }

export type StudentState = "active" | "pending" | "withdrawn" | "archived";
const studentTone: Record<StudentState, Tone> = { active: "success", pending: "warning", withdrawn: "neutral", archived: "neutral" };
export function StudentStatus({ status }: { status: StudentState }) { return <DomainStatus label={status} tone={studentTone[status]} className="capitalize" />; }

export function StudentCard({ name, subtitle, status = "active", meta, action, src }: { name: string; subtitle: string; status?: StudentState; meta?: string; action?: React.ReactNode; src?: string }) {
  return <EntityCard title={name} description={subtitle} status={<StudentStatus status={status} />} icon={<BaseStudentAvatar name={name} src={src} className="size-9" />} action={action} meta={meta && <p className="text-sm text-muted-foreground">{meta}</p>} />;
}
export function StudentTimeline({ events }: { events: TimelineEvent[] }) { return <DomainTimeline events={events} emptyLabel="No student history yet" />; }

export function GuardianSummary({ name, relationship, phone, verified = false }: { name: string; relationship: string; phone?: string; verified?: boolean }) {
  return <EntityCard title={name} description={relationship} icon={<UserRound className="size-5" aria-hidden />} status={verified ? <DomainStatus label="Verified" tone="success" /> : <DomainStatus label="Unverified" tone="warning" />} meta={phone && <span dir="ltr" className="text-sm text-muted-foreground">{phone}</span>} />;
}

export type EnrollmentState = "inquiry" | "applied" | "review" | "enrolled" | "withdrawn";
const enrollmentTone: Record<EnrollmentState, Tone> = { inquiry: "neutral", applied: "info", review: "warning", enrolled: "success", withdrawn: "neutral" };
export function EnrollmentStatus({ status, detail }: { status: EnrollmentState; detail?: string }) {
  return <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted-foreground" aria-hidden /><DomainStatus label={status} tone={enrollmentTone[status]} className="capitalize" />{detail && <span className="text-sm text-muted-foreground">{detail}</span>}</div>;
}

