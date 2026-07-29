'use client';

import { useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { useSession } from '@/lib/session-context';
import { studentName } from '@/lib/demo-store/selectors';
import { num } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { PageHeader, Gate, Kpi } from '@/components/page';

export default function TransportPage() {
  return (
    <Gate perm="bus:read">
      <Transport />
    </Gate>
  );
}

function Transport() {
  const { data } = useDemo();
  const { can } = useSession();
  const toast = useToast();
  const [busId, setBusId] = useState(data.buses[0]!.id);

  const bus = data.buses.find((b) => b.id === busId)!;
  const route = data.routes.find((r) => r.id === bus.routeId)!;
  const driver = data.drivers.find((d) => d.id === bus.driverId)!;
  const riders = route.studentIds
    .map((id) => data.students.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const totalRiders = data.routes.reduce((s, r) => s + r.studentIds.length, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Transport"
        subtitle={`${data.buses.length} buses · ${num(totalRiders)} riders`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Buses" value={num(data.buses.length)} />
        <Kpi label="Routes" value={num(data.routes.length)} />
        <Kpi label="Drivers" value={num(data.drivers.length)} />
        <Kpi label="Riders" value={num(totalRiders)} tone="cool" />
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={busId} onChange={(e) => setBusId(e.target.value)} className="w-auto">
          {data.buses.map((b) => {
            const r = data.routes.find((rt) => rt.id === b.routeId);
            return (
              <option key={b.id} value={b.id}>
                {r?.nameEn} · {b.plate}
              </option>
            );
          })}
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{route.nameEn}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            <span>
              Bus <span className="font-mono text-foreground">{bus.plate}</span>
            </span>
            <span>
              Driver <span className="text-foreground">{driver.nameEn}</span>
            </span>
            <span>
              Capacity <span className="font-mono text-foreground">{bus.capacity}</span>
            </span>
            <span>
              Riders <span className="font-mono text-foreground">{riders.length}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {route.stops.map((stop, i) => (
              <Badge key={i} tone="muted">
                {stop}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH>AM boarding</TH>
                {can('transport:create') ? <TH className="text-end">Scan</TH> : null}
              </TR>
            </THead>
            <TBody>
              {riders.map((s) => (
                <TR key={s.id}>
                  <TD>{studentName(s)}</TD>
                  <TD>
                    <Badge tone="success">Boarded 07:1{s.id.length % 9}</Badge>
                  </TD>
                  {can('transport:create') ? (
                    <TD className="text-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.success(`${studentName(s)} scanned (demo only).`)}
                      >
                        Scan boarding
                      </Button>
                    </TD>
                  ) : null}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
