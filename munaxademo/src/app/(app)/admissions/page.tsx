'use client';

import { useDemo } from '@/lib/demo-store/context';
import { fmtDate } from '@/lib/format';
import {
  Badge,
  Card,
  CardContent,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
  type Tone,
} from '@axa/platform';
import { PageHeader, Gate, Kpi } from '@/components/page';
import type { AdmissionStage } from '@/seed/types';

const STAGES: AdmissionStage[] = [
  'INQUIRY',
  'APPLIED',
  'ASSESSMENT',
  'OFFER',
  'ENROLLED',
  'REJECTED',
];
const STAGE_TONE: Record<AdmissionStage, Tone> = {
  INQUIRY: 'muted',
  APPLIED: 'default',
  ASSESSMENT: 'default',
  OFFER: 'warning',
  ENROLLED: 'success',
  REJECTED: 'danger',
};

export default function AdmissionsPage() {
  return (
    <Gate perm="student:manage">
      <Admissions />
    </Gate>
  );
}

function Admissions() {
  const { data, actions } = useDemo();
  const toast = useToast();
  const gradeName = (id: string) => data.grades.find((g) => g.id === id)?.nameEn ?? '—';

  const count = (stage: AdmissionStage) => data.admissions.filter((a) => a.stage === stage).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Admissions" subtitle="Enquiry-to-enrolment pipeline." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => (
          <Kpi
            key={s}
            label={s}
            value={String(count(s))}
            tone={s === 'ENROLLED' ? 'cool' : s === 'OFFER' ? 'warm' : undefined}
          />
        ))}
      </section>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Applicant</TH>
                <TH>Grade</TH>
                <TH>Guardian</TH>
                <TH>Applied</TH>
                <TH>Stage</TH>
                <TH>Move to</TH>
              </TR>
            </THead>
            <TBody>
              {data.admissions.map((a) => (
                <TR key={a.id}>
                  <TD>{a.applicantEn}</TD>
                  <TD>{gradeName(a.gradeId)}</TD>
                  <TD>
                    {a.guardianName}
                    <span className="block font-mono text-xs text-muted-foreground">
                      {a.guardianPhone}
                    </span>
                  </TD>
                  <TD className="font-mono text-xs">{fmtDate(a.appliedAt)}</TD>
                  <TD>
                    <Badge tone={STAGE_TONE[a.stage]}>{a.stage}</Badge>
                  </TD>
                  <TD>
                    <Select
                      value={a.stage}
                      className="h-8 w-36"
                      onChange={(e) => {
                        actions.setAdmissionStage(a.id, e.target.value as AdmissionStage);
                        toast.success(`${a.applicantEn} moved to ${e.target.value} (demo only).`);
                      }}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
