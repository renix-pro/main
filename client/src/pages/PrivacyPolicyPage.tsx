import { Link } from 'wouter';
import { ThemeToggle } from '../components/ThemeToggle';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col" data-testid="page-privacy-policy">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2 no-underline" data-testid="link-home">
          <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
          <span className="text-sm font-semibold tracking-wide text-foreground">RENIX</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 px-6 py-12">
        <div
          className="max-w-3xl mx-auto animate-fade-in-up"
        >
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 no-underline" data-testid="link-back-home">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2" data-testid="text-privacy-title">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-privacy-effective-date">
            Effective date: March 1, 2026 &middot; Last updated: March 2026
          </p>

          <div className="p-4 rounded-md bg-muted/40 border border-border/40 mb-10" data-testid="text-data-controller">
            <p className="text-foreground font-medium">Data Controller</p>
            <p className="text-muted-foreground mt-1">RENIX &middot; Berlin, Germany</p>
            <p className="text-muted-foreground mt-1">Email: privacy@renix.app</p>
          </div>

          <div className="space-y-8 text-sm text-foreground leading-relaxed">
            <section data-testid="section-introduction">
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Introduction</h2>
              <p className="text-muted-foreground">
                RENIX ("we", "our", or "us") operates the RENIX construction and renovation management platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and related services. By accessing or using RENIX, you agree to the terms of this Privacy Policy. This policy is designed to comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
              </p>
            </section>

            <section data-testid="section-data-collection">
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Information We Collect</h2>
              <p className="text-muted-foreground mb-3">We collect the following types of information:</p>
              <h3 className="text-sm font-semibold text-foreground mb-2">2.1 Account Information</h3>
              <p className="text-muted-foreground mb-3">
                When you create an account, we collect your name, email address, and hashed password. We may also collect optional profile information such as your company name and role.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">2.2 Project Data</h3>
              <p className="text-muted-foreground mb-3">
                Data you input into RENIX including project details, scope definitions, budget allocations, vendor quotes, invoices, financing information, execution progress, vision boards, and uploaded documents. RENIX provides 10 purpose-built pages: Vision, Scope, Budget, Quotes, Invoices, Financing, Execution, Documents, Overview, and Projects.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">2.3 Uploaded Documents</h3>
              <p className="text-muted-foreground mb-3">
                Files you upload for AI processing including PDF quotes, invoices, images, and other construction-related documents. These are stored securely and processed to extract structured data.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">2.4 Usage Data</h3>
              <p className="text-muted-foreground">
                We automatically collect information about how you interact with the platform, including pages visited, features used, session duration, browser type, device type, and IP address.
              </p>
            </section>

            <section data-testid="section-legal-basis">
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Legal Basis for Processing (GDPR)</h2>
              <p className="text-muted-foreground mb-3">We process your personal data on the following legal bases:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Contract Performance (Art. 6(1)(b) GDPR):</strong> Processing necessary to provide you with the RENIX platform and its features as described in our Terms of Service</li>
                <li><strong className="text-foreground">Legitimate Interests (Art. 6(1)(f) GDPR):</strong> Processing necessary for our legitimate interests, such as improving our services, ensuring platform security, and preventing fraud</li>
                <li><strong className="text-foreground">Consent (Art. 6(1)(a) GDPR):</strong> Where you have given consent, such as for optional communications or cookie preferences</li>
                <li><strong className="text-foreground">Legal Obligation (Art. 6(1)(c) GDPR):</strong> Processing necessary to comply with applicable laws and regulations</li>
              </ul>
            </section>

            <section data-testid="section-data-usage">
              <h2 className="text-lg font-semibold text-foreground mb-3">4. How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>To provide, operate, and maintain the RENIX platform and its 10 pages</li>
                <li>To process uploaded documents using AI-powered extraction and classification</li>
                <li>To generate AI companion responses, budget recommendations, and scope proposals</li>
                <li>To authenticate your identity and manage your account</li>
                <li>To improve our services, features, and user experience</li>
                <li>To send essential service communications (e.g., password resets, security alerts)</li>
                <li>To detect and prevent fraud, abuse, and security incidents</li>
                <li>To comply with legal obligations and enforce our Terms of Service</li>
              </ul>
            </section>

            <section data-testid="section-data-storage">
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Data Storage and Security</h2>
              <p className="text-muted-foreground mb-3">
                Your data is stored in PostgreSQL databases hosted on secure, managed infrastructure. We implement industry-standard security measures including encryption at rest and in transit (TLS 1.2+), secure password hashing, and regular security audits.
              </p>
              <p className="text-muted-foreground">
                Uploaded documents and files are stored using encrypted object storage with access controls that ensure only authorized users can access their own project data.
              </p>
            </section>

            <section data-testid="section-ai-processing">
              <h2 className="text-lg font-semibold text-foreground mb-3">6. AI Processing and Third-Party Services</h2>
              <p className="text-muted-foreground mb-3">
                RENIX uses OpenAI's API to power its AI companion features, including document extraction, scope proposals, budget analysis, and conversational assistance. When you interact with AI features, relevant context from your project data may be sent to OpenAI for processing.
              </p>
              <p className="text-muted-foreground mb-3">
                OpenAI processes this data according to their data usage policies. As of our current agreement, data sent via the API is not used by OpenAI to train their models. We send only the minimum context necessary for each AI interaction.
              </p>
              <p className="text-muted-foreground">
                We do not sell your data to any third party. Third-party service providers we use (hosting, AI processing, email delivery) are contractually bound to protect your data and use it only for the purposes we specify.
              </p>
            </section>

            <section id="cookies" data-testid="section-cookies">
              <h2 className="text-lg font-semibold text-foreground mb-3">7. Cookies and Local Storage</h2>
              <p className="text-muted-foreground mb-4">
                RENIX uses essential cookies and browser local storage to operate the platform. We are committed to transparency about the technologies we use. Below is a comprehensive list of all cookies and local storage items used by RENIX.
              </p>

              <h3 className="text-sm font-semibold text-foreground mb-2">7.1 Essential Cookies</h3>
              <p className="text-muted-foreground mb-2">
                These cookies are strictly necessary for the platform to function and cannot be disabled.
              </p>
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">renix_session</p>
                  <p className="text-muted-foreground text-xs mt-1">Session cookie used for user authentication. Maintains your logged-in state as you navigate the platform. Expires when your session ends or after the configured session timeout.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">sidebar:state</p>
                  <p className="text-muted-foreground text-xs mt-1">Stores your sidebar collapse/expand preference so the UI layout persists across page loads. Contains only the UI state value (expanded or collapsed).</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">7.2 Local Storage</h3>
              <p className="text-muted-foreground mb-2">
                We use browser localStorage for client-side state persistence. This data never leaves your browser and is not transmitted to our servers.
              </p>
              <div className="space-y-3 mb-4">
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">renix-theme</p>
                  <p className="text-muted-foreground text-xs mt-1">Stores your preferred colour scheme (light or dark mode) so the theme persists across visits.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">auth_token</p>
                  <p className="text-muted-foreground text-xs mt-1">Authentication token fallback used when HTTP-only cookies are unavailable. Encrypted and scoped to the RENIX domain only.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">onboarding_state</p>
                  <p className="text-muted-foreground text-xs mt-1">Tracks which onboarding steps you have completed so you are not shown the same guidance twice.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">ai_panel_width</p>
                  <p className="text-muted-foreground text-xs mt-1">Remembers your preferred width for the AI companion panel so the layout matches your preference on return.</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30 border border-border/30">
                  <p className="text-foreground font-medium text-xs">renix_cookie_consent</p>
                  <p className="text-muted-foreground text-xs mt-1">Records whether you have accepted the cookie consent banner. Contains only the value "accepted".</p>
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground mb-2">7.3 No Third-Party Tracking</h3>
              <p className="text-muted-foreground mb-4">
                RENIX does not use any third-party tracking, advertising, or analytics cookies. We do not participate in ad networks, retargeting programmes, or cross-site tracking of any kind. No data from cookies or local storage is shared with third parties for advertising purposes.
              </p>

              <h3 className="text-sm font-semibold text-foreground mb-2">7.4 Managing Your Cookie Preferences</h3>
              <p className="text-muted-foreground">
                When you first visit RENIX, a cookie consent banner is displayed. You can accept cookies or learn more about our practices. To withdraw your consent at any time, click "Cookie Settings" in the page footer, which will reset your consent preference and display the banner again. You can also clear cookies and local storage through your browser settings. Please note that disabling essential cookies may prevent the platform from functioning correctly.
              </p>
            </section>

            <section data-testid="section-international-transfers">
              <h2 className="text-lg font-semibold text-foreground mb-3">7.5 International Data Transfers</h2>
              <p className="text-muted-foreground mb-3">
                RENIX is operated from Germany within the European Union. However, certain data processing activities involve transfers of personal data to countries outside the European Economic Area (EEA), specifically:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-3">
                <li><strong className="text-foreground">OpenAI API (United States):</strong> When you use AI-powered features (document extraction, AI companion, scope proposals, budget analysis), relevant project context is transmitted to OpenAI's API servers located in the United States for processing. This transfer is necessary to provide the AI functionality described in our Terms of Service.</li>
                <li><strong className="text-foreground">Hosting Infrastructure:</strong> Our hosting provider may process data in data centres located within the EU or in jurisdictions that provide an adequate level of data protection as determined by the European Commission.</li>
              </ul>
              <p className="text-muted-foreground">
                For transfers to the United States, we rely on appropriate safeguards including Standard Contractual Clauses (SCCs) approved by the European Commission and, where applicable, the EU-US Data Privacy Framework. We ensure that all international transfers comply with Chapter V of the GDPR and that your data receives an equivalent level of protection as within the EEA.
              </p>
            </section>

            <section data-testid="section-data-retention">
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Data Retention</h2>
              <p className="text-muted-foreground mb-3">
                We retain your account data and project data for as long as your account is active. If you delete a project, its associated data (scopes, budgets, quotes, invoices, documents) is permanently removed from our systems within 30 days.
              </p>
              <p className="text-muted-foreground">
                If you delete your account, all personal data and project data is permanently deleted within 30 days. Anonymized, aggregated data that cannot be linked back to you may be retained for analytical purposes.
              </p>
            </section>

            <section data-testid="section-user-rights">
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Your Rights Under GDPR</h2>
              <p className="text-muted-foreground mb-3">As a data subject under the GDPR, you have the following rights:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Right of Access (Art. 15):</strong> Request a copy of the personal data we hold about you</li>
                <li><strong className="text-foreground">Right to Rectification (Art. 16):</strong> Request correction of inaccurate or incomplete data</li>
                <li><strong className="text-foreground">Right to Erasure (Art. 17):</strong> Request deletion of your personal data ("right to be forgotten")</li>
                <li><strong className="text-foreground">Right to Data Portability (Art. 20):</strong> Request your data in a structured, machine-readable format</li>
                <li><strong className="text-foreground">Right to Restriction (Art. 18):</strong> Request restriction of processing of your personal data</li>
                <li><strong className="text-foreground">Right to Object (Art. 21):</strong> Object to processing of your personal data for specific purposes</li>
                <li><strong className="text-foreground">Right to Withdraw Consent (Art. 7(3)):</strong> Withdraw consent at any time where processing is based on consent, without affecting the lawfulness of processing before withdrawal</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                To exercise any of these rights, please contact us at privacy@renix.app. We will respond to your request within 30 days as required by the GDPR.
              </p>
            </section>

            <section data-testid="section-supervisory-authority">
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Supervisory Authority</h2>
              <p className="text-muted-foreground mb-3">
                If you believe that our processing of your personal data infringes the GDPR, you have the right to lodge a complaint with a supervisory authority. Our lead supervisory authority is:
              </p>
              <div className="p-4 rounded-md bg-muted/40 border border-border/40">
                <p className="text-foreground font-medium">Berliner Beauftragte f&uuml;r Datenschutz und Informationsfreiheit</p>
                <p className="text-muted-foreground mt-1">(Berlin Commissioner for Data Protection and Freedom of Information)</p>
                <p className="text-muted-foreground mt-1">Friedrichstra&szlig;e 219, 10969 Berlin, Germany</p>
                <p className="text-muted-foreground mt-1">Website: www.datenschutz-berlin.de</p>
              </div>
            </section>

            <section data-testid="section-children">
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Children's Privacy</h2>
              <p className="text-muted-foreground">
                RENIX is not intended for use by individuals under the age of 16. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us so we can take appropriate action.
              </p>
            </section>

            <section data-testid="section-changes">
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last updated" date. Your continued use of RENIX after changes are posted constitutes your acceptance of the updated policy.
              </p>
            </section>

            <section data-testid="section-contact">
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about this Privacy Policy or our data practices, please contact us at:
              </p>
              <div className="mt-3 p-4 rounded-md bg-muted/40 border border-border/40">
                <p className="text-foreground font-medium">RENIX Data Protection</p>
                <p className="text-muted-foreground mt-1">RENIX &middot; Berlin, Germany</p>
                <p className="text-muted-foreground mt-1">Email: privacy@renix.app</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
