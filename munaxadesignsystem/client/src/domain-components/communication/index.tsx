import { useId, type ReactNode } from "react";
import { Bell, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ActivityFeed, MetricCard, StatusBadge, SummaryPanel, Timeline, type TimelineItem } from "../shared";

export type CommunicationState="draft"|"review"|"published"|"sent"|"delivered"|"read"|"failed"|"archived";
export function CommunicationStatusBadge({status}:{status:CommunicationState}){const tone=status==="read"||status==="delivered"?"success":status==="failed"?"danger":status==="review"?"warning":status==="published"||status==="sent"?"info":"neutral";return <StatusBadge label={status} tone={tone}/>}
export function AnnouncementCard({title,audience,status,excerpt}:{title:string;audience:string;status:CommunicationState;excerpt?:string}){return <SummaryPanel title={title} description={audience} action={<CommunicationStatusBadge status={status}/>}>{excerpt&&<p className="text-sm text-muted-foreground">{excerpt}</p>}</SummaryPanel>;}
export function NotificationCard({title,body,status="delivered",action}:{title:string;body:string;status?:CommunicationState;action?:ReactNode}){return <SummaryPanel title={title} description={body} action={<CommunicationStatusBadge status={status}/>}>{action}</SummaryPanel>;}
export function ConversationCard({participant,preview,unread=0,time}:{participant:string;preview:string;unread?:number;time?:string}){return <SummaryPanel title={participant} description={preview} action={unread?<UnreadIndicator count={unread}/>:undefined}>{time&&<time className="text-xs text-muted-foreground">{time}</time>}</SummaryPanel>;}
export function MessageThread({items}:{items:TimelineItem[]}){return <Timeline items={items} empty="No messages"/>;}
export function DeliveryStatusCard({channel,status,detail}:{channel:string;status:CommunicationState;detail?:string}){return <SummaryPanel title={channel} description={detail} action={<CommunicationStatusBadge status={status}/>}/>}
export function MessageComposer({label="Message",placeholder="Write a message…",onSend,disabled=false}:{label?:string;placeholder?:string;onSend?:()=>void;disabled?:boolean}){const id=useId();return <div className="space-y-3 rounded-xl border bg-card p-4"><label htmlFor={id} className="text-sm font-medium">{label}</label><Textarea id={id} placeholder={placeholder} disabled={disabled}/><div className="flex justify-end"><Button onClick={onSend} disabled={disabled}><Send aria-hidden/>Send</Button></div></div>;}
export function NotificationFeed({items}:{items:TimelineItem[]}){return <ActivityFeed items={items}/>}
export function UnreadIndicator({count}:{count:number}){return <StatusBadge label={`${count} unread`} tone="primary"/>;}
export function CommunicationMetrics({items}:{items:{label:string;value:string;detail?:string}[]}){return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(x=><MetricCard key={x.label}{...x}/>)}</div>;}
export { Bell, MessageSquare };
