import { Banknote, CircleDollarSign, FileText, ReceiptText } from "lucide-react";
import { FeeStatusCard as BaseFeeStatusCard, type FeeStatus } from "../school";
import { DomainMetric, DomainStatus, EntityCard, SummaryProgress, type Tone } from "./shared";

export const FeeStatusCard = BaseFeeStatusCard;
export function BalanceCard({ balance, label = "Outstanding balance", due }: { balance: string; label?: string; due?: string }) { return <DomainMetric label={label} value={balance} detail={due && `Due ${due}`} icon={<CircleDollarSign className="size-4" aria-hidden />} />; }

const feeTone: Record<FeeStatus, Tone> = { paid: "success", partial: "warning", due: "info", overdue: "danger" };
export function InvoiceCard({ number, amount, dueDate, status }: { number: string; amount: string; dueDate: string; status: FeeStatus }) {
  return <EntityCard title={number} description={`Due ${dueDate}`} icon={<FileText className="size-5" aria-hidden />} status={<DomainStatus label={status} tone={feeTone[status]} className="capitalize" />} meta={<p className="text-xl font-semibold tabular-nums">{amount}</p>} />;
}

export type PaymentState = "pending" | "settled" | "failed" | "refunded";
const paymentTone: Record<PaymentState, Tone> = { pending: "warning", settled: "success", failed: "danger", refunded: "neutral" };
export function PaymentCard({ reference, amount, method, status }: { reference: string; amount: string; method: string; status: PaymentState }) {
  return <EntityCard title={reference} description={method} icon={<ReceiptText className="size-5" aria-hidden />} status={<DomainStatus label={status} tone={paymentTone[status]} className="capitalize" />} meta={<p className="text-xl font-semibold tabular-nums">{amount}</p>} />;
}

export function CollectionSummary({ collected, billed, rate }: { collected: string; billed: string; rate: number }) { return <EntityCard title="Collection summary" description={`${collected} of ${billed}`} icon={<Banknote className="size-5" aria-hidden />}><SummaryProgress label="Collection rate" value={rate} /></EntityCard>; }
export function AgingCard({ current, days30, days60, days90 }: { current: string; days30: string; days60: string; days90: string }) {
  const buckets = [["Current", current], ["30 days", days30], ["60 days", days60], ["90+ days", days90]];
  return <EntityCard title="Receivables aging" description="Outstanding balance by age"><dl className="grid grid-cols-2 gap-3">{buckets.map(([label, value]) => <div key={label} className="rounded-lg bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{value}</dd></div>)}</dl></EntityCard>;
}

