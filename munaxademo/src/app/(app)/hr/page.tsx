'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { jod, fmtDate, num } from '@/lib/format';
import { PageHeader, Gate, Kpi } from '@/components/page';
import {
  Badge,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@axa/platform';

export default function HrPage() {
  return (
    <Gate perm="employee:manage">
      <Hr />
    </Gate>
  );
}

function Hr() {
  const { data } = useDemo();
  const [dept, setDept] = useState('');
  const [query, setQuery] = useState('');

  const departments = useMemo(
    () => [...new Set(data.employees.map((e) => e.department))].sort(),
    [data.employees],
  );

  const filtered = data.employees.filter((e) => {
    if (dept && e.department !== dept) return false;
    if (
      query &&
      !e.nameEn.toLowerCase().includes(query.toLowerCase()) &&
      !e.employeeNo.toLowerCase().includes(query.toLowerCase())
    )
      return false;
    return true;
  });

  const payroll = data.employees.reduce((s, e) => s + e.monthlySalary, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="HR & Staff" subtitle={`${data.employees.length} employees`} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Employees" value={num(data.employees.length)} />
        <Kpi
          label="Teachers"
          value={num(data.employees.filter((e) => e.kind === 'TEACHER').length)}
        />
        <Kpi
          label="Support staff"
          value={num(data.employees.filter((e) => e.kind === 'STAFF').length)}
        />
        <Kpi label="Monthly payroll" value={jod(payroll)} tone="warm" />
      </section>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Search" className="flex-1">
          <Input
            value={query}
            placeholder="Name or employee no…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Department">
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Employee No.</TH>
                <TH>Name</TH>
                <TH>Department</TH>
                <TH>Title</TH>
                <TH>Contract</TH>
                <TH>Hired</TH>
                <TH className="text-end">Salary</TH>
                <TH className="text-end">Leave</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.slice(0, 80).map((e) => (
                <TR key={e.id}>
                  <TD className="font-mono text-xs">{e.employeeNo}</TD>
                  <TD>{e.nameEn}</TD>
                  <TD>{e.department}</TD>
                  <TD>{e.titleEn}</TD>
                  <TD>
                    <Badge tone={e.contract === 'FULL_TIME' ? 'success' : 'muted'}>
                      {e.contract.replace('_', ' ')}
                    </Badge>
                  </TD>
                  <TD className="font-mono text-xs">{fmtDate(e.hireDate)}</TD>
                  <TD className="text-end font-mono">{e.monthlySalary.toFixed(3)}</TD>
                  <TD className="text-end font-mono">{e.leaveBalance}d</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
