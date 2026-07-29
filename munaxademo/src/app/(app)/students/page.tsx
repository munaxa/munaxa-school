'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useDemo } from '@/lib/demo-store/context';
import { studentName } from '@/lib/demo-store/selectors';
import { fmtDate } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  useToast,
} from '@axa/platform';
import { PageHeader, Gate } from '@/components/page';
import type { Student } from '@/seed/types';

const PAGE_SIZE = 12;

type Draft = {
  firstNameEn: string;
  fatherNameEn: string;
  familyEn: string;
  gender: 'M' | 'F';
  gradeId: string;
  sectionId: string;
};

export default function StudentsPage() {
  return (
    <Gate perm="student:manage">
      <Students />
    </Gate>
  );
}

function Students() {
  const { data, actions } = useDemo();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Student | null>(null);
  const [showForm, setShowForm] = useState(false);

  const gradeName = (id: string) => data.grades.find((g) => g.id === id)?.nameEn ?? '—';
  const sectionName = (id: string) => data.sections.find((s) => s.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.students.filter((s) => {
      if (gradeFilter && s.gradeId !== gradeFilter) return false;
      if (!q) return true;
      return (
        studentName(s).toLowerCase().includes(q) ||
        s.studentNo.includes(q) ||
        s.familyAr.includes(query)
      );
    });
  }, [data.students, query, gradeFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function remove(s: Student) {
    actions.deleteStudent(s.id);
    toast.success(`${studentName(s)} removed (demo only).`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Students"
        subtitle={`${filtered.length} of ${data.students.length} students`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            New student
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <Field label="Search" className="flex-1">
          <Input
            value={query}
            placeholder="Name, student number…"
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </Field>
        <Field label="Grade">
          <Select
            value={gradeFilter}
            onChange={(e) => {
              setGradeFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All grades</option>
            {data.grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nameEn}
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
                <TH>Student No.</TH>
                <TH>Name</TH>
                <TH>Grade</TH>
                <TH>Section</TH>
                <TH>Admitted</TH>
                <TH>Status</TH>
                <TH className="text-end">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {pageItems.map((s) => (
                <TR key={s.id}>
                  <TD className="font-mono text-xs">{s.studentNo}</TD>
                  <TD>
                    <Link
                      href={`/students/${s.id}` as never}
                      className="font-medium text-foreground hover:text-primary-strong hover:underline"
                    >
                      {studentName(s)}
                    </Link>
                    <span className="block text-xs text-muted-foreground" dir="rtl">
                      {s.firstNameAr} {s.familyAr}
                    </span>
                  </TD>
                  <TD>{gradeName(s.gradeId)}</TD>
                  <TD>{sectionName(s.sectionId)}</TD>
                  <TD className="font-mono text-xs">{fmtDate(s.admissionDate)}</TD>
                  <TD>
                    <Badge tone={s.status === 'ACTIVE' ? 'success' : 'muted'}>{s.status}</Badge>
                  </TD>
                  <TD className="text-end">
                    <span className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => remove(s)}
                      >
                        Delete
                      </Button>
                    </span>
                  </TD>
                </TR>
              ))}
              {pageItems.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="text-muted-foreground">
                    No students match your search.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {pageCount}
        </span>
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </span>
      </div>

      {showForm ? (
        <StudentForm
          student={editing}
          onClose={() => setShowForm(false)}
          onSaved={(name, isNew) => {
            toast.success(`${name} ${isNew ? 'created' : 'updated'} (demo only).`);
            setShowForm(false);
          }}
        />
      ) : null}
    </div>
  );
}

function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}) {
  const { data, actions } = useDemo();
  const firstGrade = data.grades[0]!;
  const firstSection = data.sections.find((s) => s.gradeId === firstGrade.id)!;
  const [draft, setDraft] = useState<Draft>({
    firstNameEn: student?.firstNameEn ?? '',
    fatherNameEn: student?.fatherNameEn ?? '',
    familyEn: student?.familyEn ?? '',
    gender: student?.gender ?? 'M',
    gradeId: student?.gradeId ?? firstGrade.id,
    sectionId: student?.sectionId ?? firstSection.id,
  });

  const sectionsForGrade = data.sections.filter((s) => s.gradeId === draft.gradeId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = `${draft.firstNameEn} ${draft.familyEn}`.trim();
    if (student) {
      actions.updateStudent(student.id, { ...draft });
      onSaved(name, false);
    } else {
      const created = actions.addStudent({
        ...draft,
        firstNameAr: draft.firstNameEn,
        familyAr: draft.familyEn,
        dob: '2015-01-01',
        studentNo: `${new Date().getFullYear()}${Math.floor(Math.random() * 90000 + 10000)}`,
        nationalId: `9${Math.floor(Math.random() * 1e9)}`,
        admissionDate: new Date().toISOString().slice(0, 10),
        status: 'ACTIVE',
        parentIds: [],
        hasTransport: false,
      });
      onSaved(`${created.firstNameEn} ${created.familyEn}`, true);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">
            {student ? 'Edit student' : 'New student'}
          </h2>
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <Input
                value={draft.firstNameEn}
                onChange={(e) => setDraft({ ...draft, firstNameEn: e.target.value })}
                required
              />
            </Field>
            <Field label="Father name">
              <Input
                value={draft.fatherNameEn}
                onChange={(e) => setDraft({ ...draft, fatherNameEn: e.target.value })}
              />
            </Field>
            <Field label="Family name">
              <Input
                value={draft.familyEn}
                onChange={(e) => setDraft({ ...draft, familyEn: e.target.value })}
                required
              />
            </Field>
            <Field label="Gender">
              <Select
                value={draft.gender}
                onChange={(e) => setDraft({ ...draft, gender: e.target.value as 'M' | 'F' })}
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </Select>
            </Field>
            <Field label="Grade">
              <Select
                value={draft.gradeId}
                onChange={(e) => {
                  const gradeId = e.target.value;
                  const sec = data.sections.find((s) => s.gradeId === gradeId);
                  setDraft({ ...draft, gradeId, sectionId: sec?.id ?? draft.sectionId });
                }}
              >
                {data.grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Section">
              <Select
                value={draft.sectionId}
                onChange={(e) => setDraft({ ...draft, sectionId: e.target.value })}
              >
                {sectionsForGrade.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="col-span-full mt-2 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{student ? 'Save changes' : 'Create student'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
