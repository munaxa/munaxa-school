import { useState } from "react";
import { MoreHorizontal, Users } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  AttendanceCard,
  AttendanceStatusBadge,
  FeeStatusCard,
  ParentCard,
  SchoolMetricCard,
  SchoolSwitcher,
  StudentAvatar,
  StudentCard,
  TeacherCard,
  TransportCard,
} from "@/design-system/components";

const schools = ["Munaxa International School", "Munaxa Primary Campus"];

export default function UIKitSchoolSpecific() {
  const [school, setSchool] = useState(schools[0]);

  return (
    <Layout currentPage="/school-components">
      <div className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        <header>
          <p className="text-sm font-medium text-primary">Domain layer</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            School components
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
            Typed, accessible building blocks for Munaxa’s student, staff,
            attendance, finance, transport, and school-selection workflows.
          </p>
        </header>

        <section aria-labelledby="identity-components" className="space-y-5">
          <div>
            <h2 id="identity-components" className="text-2xl font-semibold">
              People and identity
            </h2>
            <p className="mt-1 text-muted-foreground">
              Use role-specific cards for concise summaries. Keep permissions
              and navigation behavior in the consuming product.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StudentCard
              name="Lina Haddad"
              subtitle="Grade 8 · MUN-2048"
              meta="Active enrollment"
              action={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Actions for Lina Haddad"
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <TeacherCard
              name="Noura Saleh"
              subtitle="Mathematics"
              meta="Grades 7–9"
            />
            <ParentCard
              name="Omar Haddad"
              subtitle="Parent of Lina Haddad"
              meta="Primary guardian"
            />
          </div>
          <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
            <StudentAvatar name="Lina Haddad" className="size-12" />
            <div>
              <h3 className="font-semibold">StudentAvatar</h3>
              <p className="text-sm text-muted-foreground">
                Provides image fallback initials and a stable accessible name.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="operational-components" className="space-y-5">
          <div>
            <h2 id="operational-components" className="text-2xl font-semibold">
              Operational status
            </h2>
            <p className="mt-1 text-muted-foreground">
              Status is always communicated with text in addition to color.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-5">
            {(["present", "late", "absent", "excused"] as const).map(
              (status) => (
                <AttendanceStatusBadge key={status} status={status} />
              ),
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AttendanceCard
              label="Attendance rate"
              value="96.4%"
              status="present"
              detail="Current academic term"
            />
            <FeeStatusCard
              title="Term 2 tuition"
              amount="$5,000"
              paid="$3,500"
              dueDate="30 June"
              status="partial"
            />
            <TransportCard
              route="Route 12 · North District"
              stop="Al Yasmin Gate"
              driver="Ahmad Khalil"
            />
          </div>
        </section>

        <section aria-labelledby="context-components" className="space-y-5">
          <div>
            <h2 id="context-components" className="text-2xl font-semibold">
              School context and metrics
            </h2>
            <p className="mt-1 text-muted-foreground">
              Keep the active school explicit whenever data can span campuses.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_1fr]">
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-2 text-sm font-medium">
                Active school
              </p>
              <SchoolSwitcher
                schools={schools}
                value={school}
                onValueChange={setSchool}
                ariaLabel="Active school"
              />
            </div>
            <SchoolMetricCard
              label="Active students"
              value="1,842"
              trend="2.4% increase this term"
              icon={<Users className="size-4" aria-hidden />}
            />
          </div>
        </section>

        <section
          aria-labelledby="component-guidance"
          className="grid gap-6 rounded-xl border bg-muted/20 p-6 md:grid-cols-2"
        >
          <div>
            <h2 id="component-guidance" className="text-xl font-semibold">
              Best practices
            </h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-muted-foreground">
              <li>Import from the public design-system component barrel.</li>
              <li>Format locale-sensitive dates and currency before display.</li>
              <li>Keep authorization and data fetching outside components.</li>
            </ul>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold">Accessibility notes</h3>
              <p className="mt-1 text-muted-foreground">
                Supply meaningful action labels and preserve the page heading
                hierarchy. Do not rely on status color alone.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">RTL notes</h3>
              <p className="mt-1 text-muted-foreground">
                Components use logical flow. Isolate currency, identifiers, and
                phone numbers with an LTR container when Arabic content requires it.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
