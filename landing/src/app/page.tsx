import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';
import { Hero } from '@/components/sections/hero';
import { Fragmentation } from '@/components/sections/fragmentation';
import { OperatingSystem } from '@/components/sections/operating-system';
import { ConnectedDay } from '@/components/sections/connected-day';
import { FeatureSection } from '@/components/sections/feature-section';
import { Engagement } from '@/components/sections/engagement';
import { Intelligence } from '@/components/sections/intelligence';
import { Architecture } from '@/components/sections/architecture';
import { CTA } from '@/components/sections/cta';
import { Contact } from '@/components/sections/contact';
import { AdmissionsBoard } from '@/components/product/admissions-board';
import { FinanceWorkspace } from '@/components/product/finance-workspace';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Fragmentation />
        <OperatingSystem />
        <ConnectedDay />

        <FeatureSection
          id="admissions"
          index="04"
          kicker="Admissions"
          title={
            <>
              Where every
              <br />
              student begins.
            </>
          }
          lead="Move applicants from inquiry to enrolled on one board — and the moment a place is confirmed, the rest of the platform already knows."
          points={[
            { k: 'A pipeline, not a pile', v: 'Every stage from inquiry to offer, visible at a glance' },
            { k: 'One profile, forever', v: 'The application becomes the student record — nothing re-typed' },
            { k: 'No dropped hand-offs', v: 'Enrollment opens a fee plan in finance automatically' },
          ]}
          handoff="Enroll a student → a fee plan appears in Finance"
        >
          <AdmissionsBoard />
        </FeatureSection>

        <FeatureSection
          id="finance"
          index="05"
          kicker="Finance"
          title={
            <>
              The numbers,
              <br />
              finally trustworthy.
            </>
          }
          lead="Tuition, discounts, collections and balances live on the same record as the student — and every invoice is ready for JoFotara, Jordan’s e-invoicing system."
          points={[
            { k: 'Collections in real time', v: 'What’s invoiced, collected and outstanding — right now' },
            { k: 'JoFotara, built in', v: 'Compliant e-invoicing that clears without a second system' },
            { k: 'One source of truth', v: 'Finance reads the same record as admissions and academics' },
          ]}
          handoff="Balances flow straight into the parent app"
          flip
        >
          <FinanceWorkspace />
        </FeatureSection>

        <Engagement />
        <Intelligence />
        <Architecture />
        <CTA />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
