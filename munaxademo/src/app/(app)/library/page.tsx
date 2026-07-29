'use client';

import { useMemo, useState } from 'react';
import { useDemo } from '@/lib/demo-store/context';
import { studentName } from '@/lib/demo-store/selectors';
import { fmtDate, num } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
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

const LOAN_TONE: Record<string, Tone> = {
  BORROWED: 'default',
  RETURNED: 'success',
  OVERDUE: 'danger',
};

export default function LibraryPage() {
  return (
    <Gate perm="library:read">
      <Library />
    </Gate>
  );
}

function Library() {
  const { data, actions } = useDemo();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.books
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .slice(0, 40);
  }, [data.books, query]);

  const activeLoans = data.loans.filter((l) => l.status !== 'RETURNED');
  const nameOf = (sid: string) => {
    const s = data.students.find((st) => st.id === sid);
    return s ? studentName(s) : '—';
  };
  const titleOf = (bid: string) => data.books.find((b) => b.id === bid)?.title ?? '—';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Library"
        subtitle={`${data.books.length} titles · ${activeLoans.length} on loan`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Titles" value={num(data.books.length)} />
        <Kpi label="Copies" value={num(data.books.reduce((s, b) => s + b.copies, 0))} />
        <Kpi label="On loan" value={num(activeLoans.length)} tone="warm" />
        <Kpi
          label="Overdue"
          value={num(data.loans.filter((l) => l.status === 'OVERDUE').length)}
          tone="warm"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="Search catalogue">
            <Input
              value={query}
              placeholder="Title or author…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Title</TH>
                    <TH>Category</TH>
                    <TH className="text-end">Available</TH>
                  </TR>
                </THead>
                <TBody>
                  {books.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        {b.title}
                        <span className="block text-xs text-muted-foreground">{b.author}</span>
                      </TD>
                      <TD>{b.category}</TD>
                      <TD className="text-end font-mono">
                        {b.available}/{b.copies}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Active loans
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Book</TH>
                    <TH>Borrower</TH>
                    <TH>Due</TH>
                    <TH>Status</TH>
                    <TH className="text-end">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {activeLoans.slice(0, 30).map((l) => (
                    <TR key={l.id}>
                      <TD>{titleOf(l.bookId)}</TD>
                      <TD>{nameOf(l.studentId)}</TD>
                      <TD className="font-mono text-xs">{fmtDate(l.dueDate)}</TD>
                      <TD>
                        <Badge tone={LOAN_TONE[l.status] ?? 'default'}>{l.status}</Badge>
                      </TD>
                      <TD className="text-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            actions.returnBook(l.id);
                            toast.success('Book returned (demo only).');
                          }}
                        >
                          Return
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
