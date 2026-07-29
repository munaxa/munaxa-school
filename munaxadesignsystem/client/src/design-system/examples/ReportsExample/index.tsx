import { Download, FileChartColumn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
export function ReportsExample() { return <Card><CardContent className="flex items-center gap-4 pt-0"><FileChartColumn className="size-8 text-primary" aria-hidden /><div className="flex-1"><h2 className="font-semibold">Monthly attendance</h2><p className="text-sm text-muted-foreground">All campuses · Updated 10 minutes ago</p></div><Button variant="outline"><Download aria-hidden />Export</Button></CardContent></Card>; }
export default ReportsExample;
