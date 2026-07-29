import type { Metadata } from 'next';
import { LegalShell } from '@/components/site/legal-shell';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing the use of the Munaxa marketing website.',
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="These terms govern your use of this marketing website. They apply only to the website and do not govern use of the Munaxa platform, which is subject to a separate agreement between Munaxa and the relevant school."
    >
      <section>
        <h2>Use of the site</h2>
        <p>
          You may use this site to learn about Munaxa and to contact us. You agree not to misuse the
          site, including by attempting to disrupt its operation, submitting fraudulent or abusive
          content, or bypassing security controls such as rate limiting or bot protection.
        </p>
      </section>
      <section>
        <h2>Content</h2>
        <p>
          All content on this site — text, graphics, logos, and design — is the property of Munaxa or
          its licensors and is protected by applicable intellectual property laws. You may not
          reproduce or distribute it without prior written consent.
        </p>
      </section>
      <section>
        <h2>No warranty &amp; limitation of liability</h2>
        <p>
          The site and its content are provided “as is” without warranties of any kind, to the
          fullest extent permitted by law. To the fullest extent permitted by law, Munaxa shall not
          be liable for any indirect, incidental, or consequential damages arising from your use of
          the site.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{' '}
          <a className="text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>
    </LegalShell>
  );
}
