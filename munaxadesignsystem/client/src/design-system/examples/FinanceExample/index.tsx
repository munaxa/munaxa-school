import { FeeStatusCard, SchoolMetricCard, WalletCards } from "../../components";
export function FinanceExample() { return <section className="grid gap-4 md:grid-cols-2"><SchoolMetricCard label="Collected this term" value="$1.42m" trend="91% of billed fees" icon={<WalletCards className="size-4" aria-hidden />} /><FeeStatusCard title="Term 2 tuition" amount="$5,000" paid="$3,500" dueDate="30 June" status="partial" /></section>; }
export default FinanceExample;
