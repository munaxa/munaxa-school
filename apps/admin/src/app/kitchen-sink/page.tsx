'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@axa/platform';

/**
 * Design-review surface: every UI primitive in its variants/states. Not linked in the app nav —
 * open /kitchen-sink to eyeball the design system (and check RTL by toggling <html dir>).
 */
export default function KitchenSink() {
  return (
    <main className="mx-auto max-w-4xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl font-semibold">Design system</h1>
        <p className="text-sm text-muted-foreground">Munaxa UI primitives — variants & states.</p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="muted">Muted</Badge>
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>A short supporting description.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Card body content.</CardContent>
          </Card>
          <Card className="shadow-glow">
            <CardHeader>
              <CardTitle>Elevated</CardTitle>
              <CardDescription>With a primary glow.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm">Action</Button>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Text input" htmlFor="ks-text" hint="A short hint.">
            <Input id="ks-text" placeholder="Type here…" />
          </Field>
          <Field label="Select" htmlFor="ks-select">
            <Select id="ks-select" defaultValue="a">
              <option value="a">Option A</option>
              <option value="b">Option B</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <THead>
            <TR>
              <TH>Student</TH>
              <TH>Present</TH>
              <TH>Rate</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>Rana Reports</TD>
              <TD>18</TD>
              <TD>
                <Badge tone="success">95%</Badge>
              </TD>
            </TR>
            <TR>
              <TD>Adam Advanced</TD>
              <TD>12</TD>
              <TD>
                <Badge tone="warning">72%</Badge>
              </TD>
            </TR>
          </TBody>
        </Table>
      </Section>

      <Section title="Feedback">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-medium">{title}</h2>
      {children}
    </section>
  );
}
