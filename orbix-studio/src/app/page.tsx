'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowRight, Check, Github, Moon, Search, Sparkles, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RevenueChart } from '@/components/demos/revenue-chart';
import { StudentsTable } from '@/components/demos/students-table';
import { EnrollForm } from '@/components/demos/enroll-form';

const SWATCHES = [
  { name: 'background', fg: 'foreground' },
  { name: 'card', fg: 'card-foreground' },
  { name: 'primary', fg: 'primary-foreground' },
  { name: 'secondary', fg: 'secondary-foreground' },
  { name: 'muted', fg: 'muted-foreground' },
  { name: 'accent', fg: 'accent-foreground' },
  { name: 'destructive', fg: 'primary-foreground' },
  { name: 'sidebar', fg: 'sidebar-foreground' },
] as const;

const CHARTS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

export default function Page() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Orbix Studio</span>
          <Badge variant="secondary" className="ml-1">
            design system
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="GitHub">
              <Github />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-start gap-6"
        >
          <Badge variant="outline" className="gap-1.5">
            <Activity className="size-3" /> preset b7BFbeatk
          </Badge>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The Orbix Studio design system, cloned as a living showcase.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            A cool teal-cyan primary, cool-gray neutrals, and a tight 0.45rem radius — the exact
            shadcn/ui theme, rendered with Next.js 15 in light and dark.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">
              Get started <ArrowRight />
            </Button>
            <Button size="lg" variant="outline">
              View components
            </Button>
          </div>
        </motion.section>

        <Section title="Color tokens" subtitle="Semantic surfaces & foregrounds">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <div
                key={s.name}
                className="overflow-hidden rounded-lg border"
                style={{ backgroundColor: `var(--color-${s.name})` }}
              >
                <div
                  className="flex h-24 items-end p-3 text-xs font-medium"
                  style={{ color: `var(--color-${s.fg})` }}
                >
                  {s.name}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex overflow-hidden rounded-lg border">
            {CHARTS.map((c) => (
              <div
                key={c}
                className="flex h-14 flex-1 items-center justify-center text-[10px] font-medium text-foreground/70"
                style={{ backgroundColor: `var(--color-${c})` }}
              >
                {c}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons" subtitle="Six variants, four sizes">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Search">
              <Search />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Dashboard data" subtitle="Recharts area chart + TanStack data table">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
                <CardDescription>Last 7 months (JOD, thousands)</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Students</CardTitle>
                <CardDescription>Sortable — click the header.</CardDescription>
              </CardHeader>
              <CardContent>
                <StudentsTable />
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Forms & controls" subtitle="React Hook Form + Zod, inputs, switches, tabs">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Enroll student</CardTitle>
                <CardDescription>Validated with Zod.</CardDescription>
              </CardHeader>
              <CardContent>
                <EnrollForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Workspace</CardTitle>
                <CardDescription>Tabbed navigation pattern.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="overview">
                  <TabsList className="w-full">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="overview" className="pt-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>OS</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <div className="font-medium">Orbix Team</div>
                        <div className="text-muted-foreground">12 members · 3 projects</div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="activity" className="pt-4">
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-primary" /> Deployed v1.0
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-primary" /> Synced tokens
                      </li>
                    </ul>
                  </TabsContent>
                  <TabsContent value="settings" className="pt-4">
                    <p className="text-sm text-muted-foreground">
                      Theme, members, and integrations.
                    </p>
                  </TabsContent>
                </Tabs>
                <Separator />
                <div className="flex items-center gap-2">
                  <Switch id="notify" defaultChecked />
                  <Label htmlFor="notify">Email notifications</Label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Input placeholder="Search…" />
              </CardFooter>
            </Card>
          </div>
        </Section>

        <Separator />
        <footer className="pb-8 text-sm text-muted-foreground">
          Orbix Studio design system clone · shadcn/ui preset{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">b7BFbeatk</code> · Next.js 15
        </footer>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-5"
    >
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}
