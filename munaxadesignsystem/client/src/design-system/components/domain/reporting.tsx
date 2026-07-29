import type { ReactNode } from "react";
import { Download, FileChartColumn, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DomainMetric, DomainStatus, EntityCard, type Tone } from "./shared";

export type ExportState = "queued" | "processing" | "ready" | "failed" | "expired";
const exportTone: Record<ExportState, Tone> = { queued: "warning", processing: "info", ready: "success", failed: "danger", expired: "neutral" };
export function ExportStatus({ status }: { status: ExportState }) { return <DomainStatus label={status} tone={exportTone[status]} className="capitalize" />; }

export function ReportCard({ title, owner, updated, exportStatus, onOpen }: { title: string; owner: string; updated: string; exportStatus?: ExportState; onOpen?: () => void }) {
  return <EntityCard title={title} description={`Owner: ${owner}`} icon={<FileChartColumn className="size-5" aria-hidden />} status={exportStatus && <ExportStatus status={exportStatus} />} meta={<div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Updated {updated}</p>{onOpen && <Button size="sm" variant="outline" onClick={onOpen}>Open report</Button>}</div>} />;
}
export function ReportMetric(props: { label: string; value: string; detail?: string }) { return <DomainMetric {...props} icon={<FileChartColumn className="size-4" aria-hidden />} />; }
export function ReportFilterBar({ children, onRun, running = false }: { children: ReactNode; onRun?: () => void; running?: boolean }) {
  return <div role="search" aria-label="Report filters" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"><SlidersHorizontal className="mb-2 size-5 text-muted-foreground" aria-hidden /><div className="flex min-w-0 flex-1 flex-wrap gap-3">{children}</div><Button onClick={onRun} disabled={running}>{running ? "Running…" : "Run report"}</Button></div>;
}
export function ExportAction({ onExport, disabled = false }: { onExport?: () => void; disabled?: boolean }) { return <Button variant="outline" onClick={onExport} disabled={disabled}><Download aria-hidden />Export</Button>; }

