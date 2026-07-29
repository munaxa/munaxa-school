import { CalendarCheck, TriangleAlert, Users } from "lucide-react";
import { AttendanceCard as BaseAttendanceCard, AttendanceStatusBadge, type AttendanceStatus as AttendanceState } from "../school";
import { DomainMetric, DomainStatus, DomainTimeline, EntityCard, SummaryProgress, type TimelineEvent } from "./shared";

export const AttendanceCard = BaseAttendanceCard;
export function AttendanceStatus({ status }: { status: AttendanceState }) { return <AttendanceStatusBadge status={status} />; }
export function AttendanceTimeline({ events }: { events: TimelineEvent[] }) { return <DomainTimeline events={events} emptyLabel="No attendance changes" />; }

export function AttendanceSummary({ present, late, absent, excused = 0 }: { present: number; late: number; absent: number; excused?: number }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DomainMetric label="Present" value={String(present)} /><DomainMetric label="Late" value={String(late)} /><DomainMetric label="Absent" value={String(absent)} /><DomainMetric label="Excused" value={String(excused)} /></div>;
}

export function AttendanceRiskIndicator({ rate, threshold = 90 }: { rate: number; threshold?: number }) {
  const risk = rate < threshold;
  return <div className="flex items-center gap-3 rounded-lg border p-4">{risk ? <TriangleAlert className="size-5 text-warning" aria-hidden /> : <CalendarCheck className="size-5 text-success" aria-hidden />}<div className="flex-1"><p className="font-medium">{risk ? "Attendance intervention required" : "Attendance on track"}</p><SummaryProgress label="Attendance rate" value={rate} detail={risk ? `Below the ${threshold}% threshold` : `Threshold: ${threshold}%`} /></div></div>;
}

export function ClassAttendanceWidget({ className, marked, total, submitted = false }: { className: string; marked: number; total: number; submitted?: boolean }) {
  const value = total ? Math.round(marked / total * 100) : 0;
  return <EntityCard title={className} description={`${marked} of ${total} students marked`} icon={<Users className="size-5" aria-hidden />} status={<DomainStatus label={submitted ? "Submitted" : "Draft"} tone={submitted ? "success" : "warning"} />}><SummaryProgress label="Register completion" value={value} /></EntityCard>;
}

