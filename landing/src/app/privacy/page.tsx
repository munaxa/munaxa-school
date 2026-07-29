import type { Metadata } from 'next';
import { LegalShell } from '@/components/site/legal-shell';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Munaxa collects, uses, and protects information submitted through this website.',
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="How Munaxa collects, uses, and protects information submitted through this marketing website. This does not cover data processed inside the Munaxa platform itself, which is governed by the agreement between Munaxa and the relevant school."
    >
      <section>
        <h2>Information we collect</h2>
        <p>
          When you submit the contact form we collect your name, your school or organization name,
          your email address and phone number, the message you send, and technical metadata about
          the submission (IP address, browser user agent, and time) used for security and abuse
          prevention.
        </p>
      </section>
      <section>
        <h2>How we use your information</h2>
        <p>
          To respond to your inquiry and follow up about Munaxa, to send you a confirmation of
          receipt, to protect the site from spam and abuse, and to keep internal records of
          inquiries for our team.
        </p>
      </section>
      <section>
        <h2>Data retention &amp; sharing</h2>
        <p>
          Inquiry records are kept only as long as necessary to respond and for legitimate business
          record-keeping, then deleted or anonymized. We do not sell your information; submitted data
          is processed only by trusted infrastructure providers acting on our behalf (for example,
          email delivery).
        </p>
      </section>
      <section>
        <h2>Your rights &amp; security</h2>
        <p>
          You may request access to, correction of, or deletion of the information you submitted by
          emailing <a className="text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          We apply industry-standard measures — encrypted transport (HTTPS), input validation, and
          access controls — to protect information submitted through this site.
        </p>
      </section>
    </LegalShell>
  );
}
