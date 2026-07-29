import { Bus, MapPinned, UserRound } from "lucide-react";
import { DomainStatus, EntityCard, type Tone } from "./shared";

export type TransportState = "scheduled" | "boarding" | "in-transit" | "delayed" | "arrived" | "cancelled";
const transportTone: Record<TransportState, Tone> = { scheduled: "neutral", boarding: "info", "in-transit": "primary", delayed: "warning", arrived: "success", cancelled: "danger" };
export function TransportStatus({ status }: { status: TransportState }) { return <DomainStatus label={status} tone={transportTone[status]} className="capitalize" />; }

export type BoardingState = "not-boarded" | "boarded" | "absent" | "dropped-off" | "exception";
const boardingTone: Record<BoardingState, Tone> = { "not-boarded": "neutral", boarded: "info", absent: "warning", "dropped-off": "success", exception: "danger" };
export function BoardingStatus({ status }: { status: BoardingState }) { return <DomainStatus label={status} tone={boardingTone[status]} className="capitalize" />; }

export function BusCard({ number, plate, capacity, status }: { number: string; plate: string; capacity: string; status: TransportState }) {
  return <EntityCard title={number} description={plate} icon={<Bus className="size-5" aria-hidden />} status={<TransportStatus status={status} />} meta={<p className="text-sm text-muted-foreground">Capacity: {capacity}</p>} />;
}
export function RouteCard({ name, stops, status }: { name: string; stops: number; status: TransportState }) {
  return <EntityCard title={name} description={`${stops} stops`} icon={<MapPinned className="size-5" aria-hidden />} status={<TransportStatus status={status} />} />;
}
export function DriverCard({ name, phone, vehicle }: { name: string; phone?: string; vehicle?: string }) {
  return <EntityCard title={name} description={vehicle} icon={<UserRound className="size-5" aria-hidden />} meta={phone && <span dir="ltr" className="text-sm text-muted-foreground">{phone}</span>} />;
}

