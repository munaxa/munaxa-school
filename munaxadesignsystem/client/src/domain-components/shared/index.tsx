import type { ReactNode } from "react";
import { ChevronDown, Download, FileText, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
};

export function EntityAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
  return (
    <Avatar
      className={cn(
        size === "sm" && "size-8",
        size === "md" && "size-11",
        size === "lg" && "size-16"
      )}
    >
      <AvatarImage src={src} alt="" />
      <AvatarFallback aria-label={name}>{initials}</AvatarFallback>
    </Avatar>
  );
}
export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <Badge className={cn("border-0 capitalize", toneClasses[tone])}>
      {label}
    </Badge>
  );
}

export interface TimelineItem {
  id: string;
  title: string;
  detail?: string;
  time: string;
  tone?: StatusTone;
}
export function Timeline({
  items,
  empty = "No activity yet",
}: {
  items: TimelineItem[];
  empty?: string;
}) {
  if (!items.length)
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  return (
    <ol className="space-y-4">
      {items.map(x => (
        <li key={x.id} className="relative ps-6">
          <span
            className={cn(
              "absolute start-0 top-1.5 size-2.5 rounded-full",
              toneClasses[x.tone ?? "neutral"]
            )}
            aria-hidden
          />
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-medium">{x.title}</p>
            <time className="text-xs text-muted-foreground">{x.time}</time>
          </div>
          {x.detail && (
            <p className="mt-1 text-sm text-muted-foreground">{x.detail}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
export function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
        {detail && (
          <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}
export function QuickActionBar({
  actions,
  label = "Quick actions",
}: {
  actions: QuickAction[];
  label?: string;
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-2">
      {actions.map(a => (
        <Button
          key={a.id}
          variant="outline"
          size="sm"
          onClick={a.onSelect}
          disabled={a.disabled}
        >
          {a.icon}
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export function IdentityHeader({
  name,
  subtitle,
  src,
  status,
  actions,
}: {
  name: string;
  subtitle: string;
  src?: string;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center">
      <EntityAvatar name={name} src={src} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold">{name}</h1>
          {status}
        </div>
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      </div>
      {actions}
    </header>
  );
}
export function SummaryPanel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}

export interface InfoItem {
  label: string;
  value: ReactNode;
}
export function InfoGrid({
  items,
  columns = 2,
}: {
  items: InfoItem[];
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl
      className={cn(
        "grid gap-4",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "sm:grid-cols-2 lg:grid-cols-4"
      )}
    >
      {items.map(x => (
        <div key={x.label}>
          <dt className="text-xs text-muted-foreground">{x.label}</dt>
          <dd className="mt-1 text-sm font-medium">{x.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function ContactCard({
  title,
  name,
  email,
  phone,
  status,
}: {
  title: string;
  name: string;
  email?: string;
  phone?: string;
  status?: ReactNode;
}) {
  return (
    <SummaryPanel title={title} action={status}>
      <p className="font-medium">{name}</p>
      {email && (
        <a className="mt-2 block text-sm text-primary" href={`mailto:${email}`}>
          {email}
        </a>
      )}
      {phone && (
        <a
          className="mt-1 block text-sm text-primary"
          dir="ltr"
          href={`tel:${phone}`}
        >
          {phone}
        </a>
      )}
    </SummaryPanel>
  );
}

export function DocumentViewer({
  name,
  type,
  status,
  onDownload,
}: {
  name: string;
  type: string;
  status?: ReactNode;
  onDownload?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <FileText className="size-5 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{type}</p>
      </div>
      {status}
      {onDownload && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Download ${name}`}
          onClick={onDownload}
        >
          <Download aria-hidden />
        </Button>
      )}
    </div>
  );
}
export function AuditTrail({ items }: { items: TimelineItem[] }) {
  return <Timeline items={items} empty="No audit events" />;
}
export function ActivityFeed({ items }: { items: TimelineItem[] }) {
  return <Timeline items={items} empty="No recent activity" />;
}
export function TagGroup({
  tags,
  label = "Tags",
}: {
  tags: string[];
  label?: string;
}) {
  return (
    <div aria-label={label} className="flex flex-wrap gap-2">
      {tags.map(tag => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

export function EntitySwitcher({
  entities,
  value,
  onChange,
  label = "Select context",
}: {
  entities: string[];
  value: string;
  onChange?: (value: string) => void;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={label}>
          {value}
          <ChevronDown className="ms-2 size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {entities.map(e => (
          <DropdownMenuItem key={e} onSelect={() => onChange?.(e)}>
            {e}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function MoreActions({
  label = "More actions",
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  return (
    <Button variant="ghost" size="icon" aria-label={label}>
      {children ?? <MoreHorizontal aria-hidden />}
    </Button>
  );
}
