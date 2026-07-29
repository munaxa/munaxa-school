import { Bell, Megaphone, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DomainStatus, EntityCard, type Tone } from "./shared";

export type MessageState = "draft" | "review" | "published" | "sent" | "read" | "failed" | "archived";
const messageTone: Record<MessageState, Tone> = { draft: "neutral", review: "warning", published: "primary", sent: "info", read: "success", failed: "danger", archived: "neutral" };
export function MessageStatus({ status }: { status: MessageState }) { return <DomainStatus label={status} tone={messageTone[status]} className="capitalize" />; }

export type DeliveryState = "queued" | "delivered" | "read" | "failed" | "suppressed";
const deliveryTone: Record<DeliveryState, Tone> = { queued: "warning", delivered: "info", read: "success", failed: "danger", suppressed: "neutral" };
export function DeliveryStatus({ channel, status }: { channel: string; status: DeliveryState }) { return <div className="flex items-center gap-2"><span className="text-sm">{channel}</span><DomainStatus label={status} tone={deliveryTone[status]} className="capitalize" /></div>; }

export function AnnouncementCard({ title, audience, status, excerpt }: { title: string; audience: string; status: MessageState; excerpt?: string }) {
  return <EntityCard title={title} description={audience} icon={<Megaphone className="size-5" aria-hidden />} status={<MessageStatus status={status} />} meta={excerpt && <p className="text-sm text-muted-foreground">{excerpt}</p>} />;
}

export type NotificationCategory = "success" | "warning" | "error" | "info" | "approval" | "system" | "reminder" | "escalation";
const notificationTone: Record<NotificationCategory, Tone> = { success: "success", warning: "warning", error: "danger", info: "info", approval: "primary", system: "neutral", reminder: "warning", escalation: "danger" };
export function NotificationCard({ title, body, category, actionLabel, onAction }: { title: string; body: string; category: NotificationCategory; actionLabel?: string; onAction?: () => void }) {
  return <EntityCard title={title} description={body} icon={<Bell className="size-5" aria-hidden />} status={<DomainStatus label={category} tone={notificationTone[category]} className="capitalize" />}>{actionLabel && <Button className="mt-4" size="sm" onClick={onAction}>{actionLabel}</Button>}</EntityCard>;
}

export function ConversationCard({ participant, preview, unread = 0, time }: { participant: string; preview: string; unread?: number; time?: string }) {
  return <EntityCard title={participant} description={preview} icon={<MessageSquare className="size-5" aria-hidden />} status={unread > 0 ? <DomainStatus label={`${unread} unread`} tone="primary" /> : undefined} meta={time && <time className="text-xs text-muted-foreground">{time}</time>} />;
}

export { Send };

