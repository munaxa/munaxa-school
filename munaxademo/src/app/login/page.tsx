'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PERSONAS, PERSONA_BY_ID, type PersonaId } from '@/lib/rbac';
import { Logo } from '@/components/logo';
import { Button, Card, CardContent, Field, Input } from '@axa/platform';

const PERSONA_KEY = 'munaxa.demo.persona';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'auth' | 'persona'>('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [org, setOrg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Login is always shown on a light-on-dark brand surface (default dark theme).
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = (await res.json()) as {
        error?: string;
        organizationName?: string;
        role?: PersonaId | null;
      };
      if (!res.ok) throw new Error(body.error ?? 'Login failed');
      setOrg(body.organizationName ?? 'Munaxa Academy');
      // Role-locked prospect accounts go straight in; admins choose a persona.
      if (body.role && PERSONA_BY_ID[body.role]) {
        choosePersona(body.role);
        return;
      }
      setStep('persona');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function choosePersona(id: PersonaId) {
    sessionStorage.setItem(PERSONA_KEY, id);
    const persona = PERSONAS.find((p) => p.id === id)!;
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace((next || persona.home) as never);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      {step === 'auth' ? (
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <span className="mx-auto inline-flex w-fit">
              <Logo variant="stacked" size={96} priority />
            </span>
            <h1 className="font-display text-2xl font-semibold">Live Demo</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your demonstration credentials.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
                <Field label="Username" htmlFor="username">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="futureacademy-demo"
                    required
                  />
                </Field>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Field>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Don’t have access yet?{' '}
            <Link
              href={'/request-demo' as never}
              className="font-medium text-primary-strong hover:underline"
            >
              Book a demo
            </Link>
          </p>
        </div>
      ) : (
        <div className="w-full max-w-3xl space-y-6">
          <div className="space-y-2 text-center">
            <span className="mx-auto inline-flex w-fit">
              <Logo variant="stacked" size={72} priority />
            </span>
            <h1 className="font-display text-2xl font-semibold">Choose a role to explore</h1>
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{org}</span>. Each role has
              its own permissions, dashboard and navigation — switch any time from inside the demo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => choosePersona(p.id)}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 text-start shadow-card transition hover:border-primary/40 hover:shadow-glow"
              >
                <span className="font-display text-base font-semibold group-hover:text-primary-strong">
                  {p.nameEn}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {p.titleEn}
                </span>
                <span className="mt-2 text-xs text-muted-foreground">{p.blurbEn}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
