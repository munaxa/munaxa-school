'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button, Card, CardContent, Field, Input, Select } from '@axa/platform';

interface Form {
  schoolName: string;
  contactPerson: string;
  jobTitle: string;
  country: string;
  numStudents: string;
  numCampuses: string;
  email: string;
  phone: string;
  notes: string;
}

const EMPTY: Form = {
  schoolName: '',
  contactPerson: '',
  jobTitle: '',
  country: 'Jordan',
  numStudents: '',
  numCampuses: '1',
  email: '',
  phone: '',
  notes: '',
};

export default function RequestDemoPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  function set<K extends keyof Form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          numStudents: Number(form.numStudents) || 0,
          numCampuses: Number(form.numCampuses) || 0,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Submission failed');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <Logo variant="stacked" size={88} priority className="mx-auto" />
          <Card>
            <CardContent className="space-y-3 pt-6">
              <h1 className="font-display text-2xl font-semibold">Thank you</h1>
              <p className="text-sm text-muted-foreground">
                Your demo request has been received — a confirmation email is on its way. The Munaxa
                team will review it and reply as soon as possible with your private demo access.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm font-medium text-primary-strong hover:underline"
              >
                Already have credentials? Sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <Logo variant="stacked" size={80} priority className="mx-auto" />
          <h1 className="font-display text-2xl font-semibold">Book a Munaxa demo</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your school and our team will set up a private, guided demonstration with
            credentials tailored to your needs.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
              <Field label="School name" className="sm:col-span-2">
                <Input
                  value={form.schoolName}
                  onChange={(e) => set('schoolName', e.target.value)}
                  required
                />
              </Field>
              <Field label="Contact person">
                <Input
                  value={form.contactPerson}
                  onChange={(e) => set('contactPerson', e.target.value)}
                  required
                />
              </Field>
              <Field label="Job title">
                <Input
                  value={form.jobTitle}
                  onChange={(e) => set('jobTitle', e.target.value)}
                  placeholder="Principal, Owner…"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+962…"
                />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => set('country', e.target.value)} />
              </Field>
              <Field label="Campuses">
                <Select
                  value={form.numCampuses}
                  onChange={(e) => set('numCampuses', e.target.value)}
                >
                  {['1', '2', '3', '4', '5+'].map((n) => (
                    <option key={n} value={n.replace('+', '')}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Number of students" className="sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  value={form.numStudents}
                  onChange={(e) => set('numStudents', e.target.value)}
                  placeholder="e.g. 850"
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Input
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Anything you'd like us to know"
                />
              </Field>

              {error ? (
                <p className="text-sm text-destructive sm:col-span-2" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between sm:col-span-2">
                <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  Have credentials? Sign in
                </Link>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Submitting…' : 'Request demo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
