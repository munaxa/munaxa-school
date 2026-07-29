import type { ReactNode } from "react";
import { CircleAlert, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

export function DomainStatus({ label, tone = "neutral", className }: { label: string; tone?: Tone; className?: string }) {
  return <Badge className={cn("border-0", tones[tone], className)}>{label}</Badge>;
}

export interface EntityCardProps {
  title: string;
  description?: string;
  status?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}
export function EntityCard({ title, description, status, icon, meta, action, children, className }: EntityCardProps) {
  return <Card className={className}><CardHeader className="flex-row items-start gap-3">{icon && <span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>}<div className="min-w-0 flex-1"><CardTitle className="truncate">{title}</CardTitle>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{status}{action}</CardHeader>{(meta || children) && <CardContent>{meta}{children}</CardContent>}</Card>;
}

export interface TimelineEvent { id: string; title: string; detail?: string; time: string; tone?: Tone }
export function DomainTimeline({ events, emptyLabel = "No activity yet" }: { events: TimelineEvent[]; emptyLabel?: string }) {
  if (!events.length) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  return <ol className="space-y-4">{events.map((event) => <li key={event.id} className="relative ps-6"><span className={cn("absolute start-0 top-1.5 size-2.5 rounded-full", tones[event.tone ?? "neutral"])} aria-hidden /><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-medium">{event.title}</p><time className="text-xs text-muted-foreground">{event.time}</time></div>{event.detail && <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>}</li>)}</ol>;
}

export function DomainMetric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon?: ReactNode }) {
  return <Card><CardContent className="pt-0"><div className="flex items-center justify-between text-sm text-muted-foreground"><span>{label}</span>{icon}</div><p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>{detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}</CardContent></Card>;
}

export function SummaryProgress({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return <div><div className="mb-2 flex justify-between gap-4 text-sm"><span>{label}</span><span className="font-medium tabular-nums">{value}%</span></div><Progress value={value} />{detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}</div>;
}

export const statusIcons = { warning: <CircleAlert className="size-4" aria-hidden />, pending: <Clock3 className="size-4" aria-hidden /> };

