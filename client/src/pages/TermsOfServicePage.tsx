import { Link } from 'wouter';
import { ThemeToggle } from '../components/ThemeToggle';
import renixLogo from '@assets/RENIX_logo_1770443349731.png';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col" data-testid="page-terms-of-service">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <Link href="/" className="flex items-center gap-2 no-underline" data-testid="link-home">
          <img src={renixLogo} alt="RENIX" className="h-5 w-5 dark:invert" />
          <span className="text-sm font-semibold tracking-wide text-foreground">RENIX</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-1 px-6 py-12">
        <div
          className="max-w-3xl mx-auto animate-tos-enter"
        >
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 no-underline" data-testid="link-back-home">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2" data-testid="text-terms-title">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground mb-10" data-testid="text-terms-effective-date">
            Effective date: March 1, 2026 &middot; Last updated: March 2026
          </p>

          <div className="space-y-8 text-sm text-foreground leading-relaxed">
            <section data-testid="section-acceptance">
              <h2 className="text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using the RENIX platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service. These Terms constitute a legally binding agreement between you and RENIX ("we", "our", or "us").
              </p>
            </section>

            <section data-testid="section-description">
              <h2 className="text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
              <p className="text-muted-foreground mb-3">
                RENIX is an AI-powered construction and renovation management platform that provides 10 purpose-built pages for comprehensive project control:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Vision</strong> &mdash; Mood boards, inspiration, and desire statements</li>
                <li><strong className="text-foreground">Scope</strong> &mdash; Hierarchical scope definition and work breakdown</li>
                <li><strong className="text-foreground">Budget</strong> &mdash; Budget allocation, tracking, and contingency management</li>
                <li><strong className="text-foreground">Quotes</strong> &mdash; Quote ingestion, AI extraction, comparison, and versioning</li>
                <li><strong className="text-foreground">Invoices</strong> &mdash; Invoice tracking and payment management</li>
                <li><strong className="text-foreground">Financing</strong> &mdash; Financing source management and cost resolution</li>
                <li><strong className="text-foreground">Execution</strong> &mdash; Task scheduling, Gantt timeline, and progress tracking</li>
                <li><strong className="text-foreground">Documents</strong> &mdash; Document storage and AI-powered intelligence</li>
                <li><strong className="text-foreground">Overview</strong> &mdash; Project health dashboard and cross-page insights</li>
                <li><strong className="text-foreground">Projects</strong> &mdash; Multi-project portfolio management</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                The Service includes an AI companion that assists with document extraction, data analysis, budget recommendations, and project insights.
              </p>
            </section>

            <section data-testid="section-accounts">
              <h2 className="text-lg font-semibold text-foreground mb-3">3. Account Registration and Responsibility</h2>
              <p className="text-muted-foreground mb-3">
                To use RENIX, you must create an account by providing accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>You must be at least 16 years old to create an account</li>
                <li>You must provide a valid email address and accurate personal information</li>
                <li>You are responsible for safeguarding your password and must notify us immediately of any unauthorized access</li>
                <li>You may not share your account credentials or allow others to access your account</li>
                <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
              </ul>
            </section>

            <section data-testid="section-acceptable-use">
              <h2 className="text-lg font-semibold text-foreground mb-3">4. Acceptable Use</h2>
              <p className="text-muted-foreground mb-3">You agree to use RENIX only for lawful purposes and in accordance with these Terms. You may not:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Upload malicious files, viruses, or harmful content</li>
                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Use automated systems (bots, scrapers) to access the Service without our written permission</li>
                <li>Upload content that infringes on the intellectual property rights of others</li>
                <li>Use the AI features to generate harmful, misleading, or abusive content</li>
              </ul>
            </section>

            <section data-testid="section-subscription">
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Subscription Plans and Billing</h2>
              <h3 className="text-sm font-semibold text-foreground mb-2">5.1 Free Plan</h3>
              <p className="text-muted-foreground mb-3">
                The Free plan is available at no cost, forever. It includes 1 active project, access to all 10 pages, basic AI document ingestion (up to 20 documents), basic AI companion features, and community support. No credit card is required.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">5.2 Pro Plan</h3>
              <p className="text-muted-foreground mb-3">
                The Pro plan costs &euro;9.99 per month and includes unlimited projects, unlimited documents, full AI companion capabilities, unlimited quote versions, advanced AI insights, and priority email support.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">5.3 Billing Terms</h3>
              <p className="text-muted-foreground">
                All prices are stated in euros (&euro;). Paid subscriptions are billed monthly in advance. You may cancel your subscription at any time, and cancellation takes effect at the end of the current billing period. We do not provide refunds for partial billing periods. We reserve the right to change pricing with 30 days' advance notice.
              </p>
            </section>

            <section data-testid="section-intellectual-property">
              <h2 className="text-lg font-semibold text-foreground mb-3">6. Intellectual Property</h2>
              <h3 className="text-sm font-semibold text-foreground mb-2">6.1 Our Property</h3>
              <p className="text-muted-foreground mb-3">
                The Service, including its design, code, features, branding, documentation, and AI models, is owned by RENIX and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Service without our written permission.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">6.2 Your Content</h3>
              <p className="text-muted-foreground">
                You retain ownership of all data, documents, and content you upload to RENIX ("Your Content"). By uploading content, you grant us a limited, non-exclusive license to store, process, and display Your Content solely for the purpose of providing the Service. We do not claim ownership over Your Content and will not use it for any purpose other than operating the Service.
              </p>
            </section>

            <section data-testid="section-ai-disclaimer">
              <h2 className="text-lg font-semibold text-foreground mb-3">7. AI Features and Disclaimer</h2>
              <p className="text-muted-foreground mb-3">
                RENIX's AI companion provides automated suggestions, document extraction, budget analysis, and scope recommendations. While we strive for accuracy, AI-generated content may contain errors, omissions, or inaccuracies.
              </p>
              <p className="text-muted-foreground">
                You acknowledge that AI outputs are suggestions only and should not be relied upon as professional advice. All AI proposals require your explicit confirmation before being applied. You are solely responsible for reviewing and validating AI-generated data before making financial or project decisions.
              </p>
            </section>

            <section data-testid="section-limitation-liability">
              <h2 className="text-lg font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, RENIX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
              </p>
              <p className="text-muted-foreground">
                Our total liability for any claim arising out of or relating to these Terms or the Service shall not exceed the amount you paid to RENIX in the twelve (12) months preceding the claim, or &euro;100, whichever is greater.
              </p>
            </section>

            <section data-testid="section-warranty-disclaimer">
              <h2 className="text-lg font-semibold text-foreground mb-3">9. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. WE DISCLAIM ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>
            </section>

            <section data-testid="section-cookies">
              <h2 className="text-lg font-semibold text-foreground mb-3">10. Cookies and Consent</h2>
              <p className="text-muted-foreground mb-3">
                RENIX uses essential cookies and local storage to provide core functionality, including authentication, UI preferences, and session management. We do not use third-party tracking, advertising, or analytics cookies.
              </p>
              <p className="text-muted-foreground">
                By using the Service, you consent to our use of essential cookies as described in our{' '}
                <Link href="/privacy" className="text-foreground underline underline-offset-2" data-testid="link-privacy-from-terms">
                  Privacy Policy
                </Link>
                . You may manage your cookie preferences at any time through the cookie consent mechanism provided on our website.
              </p>
            </section>

            <section data-testid="section-termination">
              <h2 className="text-lg font-semibold text-foreground mb-3">11. Termination</h2>
              <p className="text-muted-foreground mb-3">
                You may terminate your account at any time by contacting us or using the account deletion feature. We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice.
              </p>
              <p className="text-muted-foreground">
                Upon termination, your right to use the Service ceases immediately. We will delete your data in accordance with our Privacy Policy. Sections of these Terms that by their nature should survive termination (including intellectual property, limitation of liability, and governing law) will survive.
              </p>
            </section>

            <section data-testid="section-indemnification">
              <h2 className="text-lg font-semibold text-foreground mb-3">12. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify, defend, and hold harmless RENIX, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any third-party rights.
              </p>
            </section>

            <section data-testid="section-governing-law">
              <h2 className="text-lg font-semibold text-foreground mb-3">13. Governing Law and Disputes</h2>
              <p className="text-muted-foreground mb-3">
                These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Germany, without regard to its conflict of law provisions. The courts of Berlin, Germany, shall have exclusive jurisdiction over any disputes arising out of or relating to these Terms.
              </p>
              <p className="text-muted-foreground">
                Before filing any legal action, you agree to attempt to resolve disputes informally by contacting us. If a dispute cannot be resolved informally within 30 days, either party may pursue formal resolution through the courts specified above.
              </p>
            </section>

            <section data-testid="section-changes">
              <h2 className="text-lg font-semibold text-foreground mb-3">14. Changes to These Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the "Last updated" date. Your continued use of the Service after changes are posted constitutes your acceptance of the updated Terms. If you do not agree to the modified Terms, you should discontinue use of the Service.
              </p>
            </section>

            <section data-testid="section-contact">
              <h2 className="text-lg font-semibold text-foreground mb-3">15. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="mt-3 p-4 rounded-md bg-muted/40 border border-border/40">
                <p className="text-foreground font-medium">RENIX Support</p>
                <p className="text-muted-foreground mt-1">Email: legal@renix.app</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
