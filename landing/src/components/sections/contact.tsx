'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Clock, MapPin, Loader2, CheckCircle2, AlertCircle, Send } from '@axa/platform/icons';
import { Button, Input, Label, Reveal, Textarea, cn } from '@axa/platform';
import { CONTACT_EMAIL } from '@/lib/site';

type Status = 'idle' | 'submitting' | 'success' | 'error';
type FieldName = 'name' | 'schoolName' | 'email' | 'phone' | 'message';
type FieldErrors = Partial<Record<FieldName, string>>;

type ApiResult = {
  ok: boolean;
  error?: string;
  issues?: { fieldErrors?: Partial<Record<FieldName, string[]>> };
};

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * Contact us. A functional message form posts to /api/contact (zod-validated, rate-limited,
 * honeypot-protected), which sends the designed Munaxa welcome email to the visitor and an
 * internal notification to the sales inbox. Validation errors are surfaced per field so the
 * visitor knows exactly what to fix.
 */
export function Contact() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);
    setFieldErrors({});

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    const payload = {
      name: field(formData, 'name'),
      schoolName: field(formData, 'schoolName'),
      email: field(formData, 'email'),
      phone: field(formData, 'phone'),
      message: field(formData, 'message'),
      website: field(formData, 'website'), // honeypot
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok || !result.ok) {
        setStatus('error');
        const raw = result.issues?.fieldErrors;
        if (raw) {
          const mapped: FieldErrors = {};
          (Object.keys(raw) as FieldName[]).forEach((key) => {
            const msg = raw[key]?.[0];
            if (msg) mapped[key] = msg;
          });
          setFieldErrors(mapped);
          setError(
            Object.keys(mapped).length
              ? 'Please fix the highlighted fields and try again.'
              : (result.error ?? 'Something went wrong. Please try again.'),
          );
        } else {
          setError(result.error ?? 'Something went wrong. Please try again.');
        }
        return;
      }

      setStatus('success');
      formEl.reset();
    } catch {
      setStatus('error');
      setError('Network error. Please check your connection and try again.');
    }
  }

  /** Inline error text + a11y wiring for a field. */
  function fieldProps(name: FieldName) {
    const err = fieldErrors[name];
    return {
      'aria-invalid': err ? true : undefined,
      'aria-describedby': err ? `${name}-error` : undefined,
    };
  }
  function FieldError({ name }: { name: FieldName }) {
    const err = fieldErrors[name];
    if (!err) return null;
    return (
      <p id={`${name}-error`} className="mt-1.5 text-xs font-medium text-destructive">
        {err}
      </p>
    );
  }

  return (
    <section id="contact" className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div className="brand-glow pointer-events-none absolute -top-20 left-1/2 -z-10 h-[420px] w-[820px] max-w-[92vw] -translate-x-1/2" aria-hidden />

      <div className="shell grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        {/* Left — invitation + contact rail */}
        <Reveal>
          <p className="eyebrow">09 — Contact us</p>
          <h2 className="display mt-4 text-4xl sm:text-5xl">
            Let&apos;s talk about
            <br />
            your school.
          </h2>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Have a question or want to learn more? Tell us about your school and our team will get
            back to you. Ready to see Munaxa in action? Book a demo instead.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: Mail, label: 'Email us', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
              { icon: Clock, label: 'Response time', value: 'Within one business day' },
              {
                icon: MapPin,
                label: 'Where we work',
                value: 'Schools & groups across Jordan and the region',
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.label} className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary-strong">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.72rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {c.label}
                    </span>
                    {c.href ? (
                      <a
                        href={c.href}
                        className="mono text-sm font-medium text-foreground transition hover:text-primary-strong"
                      >
                        {c.value}
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-foreground">{c.value}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {/* Right — the form */}
        <Reveal delay={100}>
          <form onSubmit={(event) => void handleSubmit(event)} className="panel p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  {...fieldProps('name')}
                />
                <FieldError name="name" />
              </div>
              <div>
                <Label htmlFor="schoolName">School / group</Label>
                <Input
                  id="schoolName"
                  name="schoolName"
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={150}
                  {...fieldProps('schoolName')}
                />
                <FieldError name="schoolName" />
              </div>
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  {...fieldProps('email')}
                />
                <FieldError name="email" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  minLength={7}
                  maxLength={20}
                  className="mono"
                  dir="ltr"
                  {...fieldProps('phone')}
                />
                <FieldError name="phone" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="Tell us about your school — campuses, grade levels, and what you're looking for."
                  {...fieldProps('message')}
                />
                <FieldError name="message" />
              </div>
            </div>

            {/* Honeypot — hidden from real users; bots that fill every field are silently dropped. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-6 w-full"
              disabled={status === 'submitting'}
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  Send message
                  <Send className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>

            {status === 'success' && (
              <p className={cn('mt-4 flex items-center gap-2 text-sm font-medium text-accent-cool')} role="status">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Thank you! We&apos;ve received your message and will be in touch shortly.
              </p>
            )}
            {status === 'error' && error && (
              <p
                className="mt-4 flex items-center gap-2 text-sm font-medium text-destructive"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              By submitting this form you agree to be contacted by Munaxa about your inquiry.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
