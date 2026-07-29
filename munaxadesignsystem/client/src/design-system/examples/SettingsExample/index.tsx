import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function SettingsExample() { return <form className="max-w-xl space-y-6"><div><h2 className="text-2xl font-semibold">Attendance policy</h2><p className="text-sm text-muted-foreground">Thresholds apply to intervention reports from the next school day.</p></div><div className="space-y-2"><Label htmlFor="attendance-threshold">Low attendance threshold (%)</Label><Input id="attendance-threshold" type="number" min="0" max="100" defaultValue="90" /></div><Button type="submit">Save changes</Button></form>; }
export default SettingsExample;
