import type { ReactNode } from "react";
import { ArrowUpRight, MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type DashboardMetric = {
  label: string;
  value: string;
  change?: string;
  icon: LucideIcon;
};
export interface DashboardTemplateProps {
  eyebrow: string;
  title: string;
  description: string;
  metrics: DashboardMetric[];
  primary: ReactNode;
  secondary: ReactNode;
  actions?: ReactNode;
}

export function DashboardTemplate({
  eyebrow,
  title,
  description,
  metrics,
  primary,
  secondary,
  actions,
}: DashboardTemplateProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          {actions}
          <Button
            variant="outline"
            size="icon"
            aria-label="More dashboard actions"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </div>
      </header>
      <section
        aria-label="Key metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, change, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{label}</span>
                <Icon className="size-4" aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {value}
              </p>
              {change && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="size-3" aria-hidden />
                  {change}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>{primary}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>{secondary}</CardContent>
        </Card>
      </section>
    </div>
  );
}
