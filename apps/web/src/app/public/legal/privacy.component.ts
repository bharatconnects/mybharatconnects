import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [NavbarComponent, FooterComponent],
  styles: [
    `
      .doc {
        max-width: 860px;
        margin: 0 auto;
        padding: 48px 24px 80px;
        font-size: 15px;
        line-height: 1.7;
        color: #222;
      }
      .doc h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 6px;
        color: #111;
      }
      .doc .meta {
        font-size: 13px;
        color: #666;
        margin-bottom: 36px;
      }
      .doc h2 {
        font-size: 17px;
        font-weight: 700;
        margin: 36px 0 8px;
        color: #111;
      }
      .doc h3 {
        font-size: 15px;
        font-weight: 600;
        margin: 24px 0 6px;
        color: #111;
      }
      .doc p {
        margin: 0 0 12px;
      }
      .doc ul {
        margin: 0 0 12px 20px;
        padding: 0;
      }
      .doc ul li {
        margin-bottom: 4px;
      }
      .doc .notice {
        background: #f5f5f5;
        border-left: 3px solid #999;
        padding: 10px 14px;
        margin: 12px 0;
        font-size: 14px;
      }
      .doc hr {
        border: none;
        border-top: 1px solid #e0e0e0;
        margin: 40px 0;
      }
      .doc a {
        color: #1a0dab;
      }
    `,
  ],
  template: `
    <app-navbar />
    <div style="background:#fff; min-height:100vh;">

      <div class="doc">
        <h1>Privacy Policy</h1>
        <p class="meta">
          Bharat Connects LLC &nbsp;|&nbsp; Effective Date: July 14, 2026 &nbsp;|&nbsp;
          <a href="mailto:privacy@mybharatconnects.com">privacy&#64;mybharatconnects.com</a>
        </p>

        <h2>1. Introduction</h2>
        <p>
          Bharat Connects LLC ('Bharat Connects,' 'Company,' 'we,' 'us,' or 'our') is a limited
          liability company organized under the laws of the State of North Carolina, United States.
          We provide administrative and coordination services to Non-Resident Indians (NRIs)
          residing in the United States who wish to obtain independent professional services in
          India, including Tax Filing Coordination, Legal Documentation Coordination, Elder Care
          Coordination, Investment/Insurance Coordination, and Real Estate Administrative
          Coordination (limited to real property located in India).
        </p>
        <p>
          This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you visit our website (www.mybharatconnects.com), use our client portal, or engage
          with our services. By accessing our website or engaging our services, you expressly
          consent to the collection, use, transfer, and processing of your information as described
          in this Privacy Policy. If you do not agree, you must discontinue use immediately.
        </p>
        <p>
          <strong>Scope:</strong> This policy applies to all users of our website and services,
          including clients (NRIs), Indian Professionals, and Case Managers. This Policy is
          incorporated into and forms an integral part of our Terms and Conditions.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide Directly</h3>
        <p>
          When you submit a service inquiry, create an account, or engage our services, we collect:
        </p>
        <ul>
          <li>Full name, email address, phone number, and mailing address (US and India)</li>
          <li>
            Passport number, PAN card number, OCI/PIO card details, Aadhaar (where legally
            permissible)
          </li>
          <li>
            Financial information including bank account details (NRE/NRO), income, and investment
            preferences
          </li>
          <li>Tax identification numbers (US SSN/ITIN, Indian PAN)</li>
          <li>
            Property and asset information for legal documentation and Indian real estate
            coordination services
          </li>
          <li>Healthcare and emergency contact information for elder care coordination</li>
          <li>Identity documents, legal agreements, and signed contracts uploaded to our portal</li>
          <li>Payment card details processed through our PCI-DSS compliant payment processor</li>
          <li>Communications with Case Managers, service preferences, and feedback</li>
        </ul>
        <h3>2.2 Information Collected Automatically</h3>
        <ul>
          <li>IP address, browser type, operating system, and device identifiers</li>
          <li>Pages visited, time spent, referring URLs, and click-stream data</li>
          <li>Cookies, web beacons, and similar tracking technologies (see Section 8)</li>
          <li>Geographic location data (country/state level)</li>
        </ul>
        <h3>2.3 Information from Third Parties</h3>
        <ul>
          <li>Identity verification data from KYC/AML service providers</li>
          <li>Payment confirmation data from Stripe</li>
          <li>Google Analytics usage statistics</li>
          <li>Social media interaction data if you contact us through social platforms</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <h3>3.1 Service Delivery</h3>
        <ul>
          <li>To process your service request and coordinate an appropriate Indian Professional</li>
          <li>To assign a Case Manager based in India to coordinate your engagement</li>
          <li>To facilitate communication between you and your assigned Case Manager</li>
          <li>
            To forward only the minimum necessary information to Indian Professionals after
            engagement
          </li>
          <li>To track service progress, manage timelines, and coordinate service delivery</li>
          <li>To facilitate document collection, upload, review, and secure delivery</li>
        </ul>
        <h3>3.2 Account and Payment Management</h3>
        <ul>
          <li>To create and manage your client account and portal access</li>
          <li>To process payments, issue invoices, and maintain billing records</li>
          <li>To process temporary payment authorizations and final payment captures</li>
          <li>To generate and deliver service receipts and tax documentation</li>
        </ul>
        <h3>3.3 Legal and Compliance</h3>
        <ul>
          <li>To verify your identity and comply with KYC/AML obligations</li>
          <li>
            To comply with applicable US federal and state laws (including OFAC sanctions screening)
          </li>
          <li>To comply with the Indian Information Technology Act, 2000 and associated rules</li>
          <li>
            To comply with FEMA, RBI, RERA, and other regulations applicable to NRI financial and
            real estate transactions
          </li>
          <li>To maintain records required by applicable tax and regulatory authorities</li>
        </ul>
        <h3>3.4 Communication and Marketing</h3>
        <ul>
          <li>To send service updates, case status notifications, and document requests</li>
          <li>
            To send promotional content, newsletters, and NRI service guides (with your consent)
          </li>
          <li>To respond to your inquiries, complaints, and feedback</li>
          <li>To notify you of changes to our services, pricing, or this Privacy Policy</li>
        </ul>
        <h3>3.5 Legitimate Business Interests</h3>
        <ul>
          <li>To analyze usage patterns and improve our website and client portal</li>
          <li>To conduct internal research and quality assessments</li>
          <li>To prevent fraud, abuse, unauthorized access, and to protect our legal rights</li>
          <li>To enforce our Terms and Conditions and other agreements</li>
          <li>To defend Bharat Connects LLC in any legal claim, investigation, or dispute</li>
        </ul>

        <h2>4. How We Share Your Information</h2>
        <h3>4.1 With Indian Professionals</h3>
        <p>
          We share your information with Indian Professionals ONLY after you have confirmed a
          service engagement and only to the extent necessary to deliver that specific service.
          Indian Professionals are bound by binding confidentiality and Non-Disclosure Agreements
          (NDAs), Sub-Contractor Agreements with strict data handling obligations, and Service Level
          Agreements governing data security.
        </p>
        <div class="notice">
          Important: Indian Professionals are independent contractors, not employees, agents, or
          partners of Bharat Connects LLC. They have no authority to use your information for any
          purpose other than delivering your specific service. Bharat Connects LLC is not liable for
          any independent acts or omissions of Indian Professionals beyond our reasonable oversight
          obligations.
        </div>
        <h3>4.2 With Case Managers</h3>
        <p>
          Case Managers employed or contracted by Bharat Connects LLC have access to your
          information as necessary to coordinate and oversee your service engagement, subject to
          confidentiality obligations.
        </p>
        <h3>4.3 With Service Providers</h3>
        <ul>
          <li>Payment processor (Stripe) &mdash; for payment processing only</li>
          <li>Identity verification providers &mdash; for KYC/AML compliance</li>
          <li>Cloud storage and CRM providers &mdash; under binding data processing agreements</li>
          <li>Email service providers &mdash; for transactional and marketing communications</li>
          <li>Analytics providers &mdash; for aggregated, anonymized usage data</li>
        </ul>
        <h3>4.4 Legal Disclosures</h3>
        <p>
          We may disclose your information without further notice if required or permitted to do so
          by law, court order, subpoena, or governmental request, or in our good faith belief that
          such disclosure is necessary to (i) comply with a legal obligation; (ii) protect and
          defend the rights, property, safety, or legal interests of Bharat Connects LLC, our
          clients, employees, or Indian Professionals; (iii) prevent or investigate possible
          wrongdoing, fraud, or security issues; (iv) enforce our Terms and Conditions; or (v)
          respond to any claim, dispute, or legal proceeding involving Bharat Connects LLC.
        </p>
        <h3>4.5 Business Transfers</h3>
        <p>
          In the event of a merger, acquisition, reorganization, financing, sale of assets,
          bankruptcy, or similar transaction, your information may be transferred as a business
          asset without your separate consent.
        </p>

        <h2>5. Data Security</h2>
        <p>
          We implement industry-standard technical and organizational security measures, including:
        </p>
        <ul>
          <li>SSL/TLS encryption for data transmission</li>
          <li>AES-256 encryption for data at rest</li>
          <li>Role-based access controls limiting employee access</li>
          <li>Multi-factor authentication for portal access</li>
          <li>Regular security audits and vulnerability assessments</li>
          <li>Secure document storage with access logging</li>
          <li>PCI-DSS compliant payment processing (we do not store card numbers)</li>
        </ul>
        <p>
          Despite these measures, no method of Internet transmission or electronic storage is 100%
          secure. You acknowledge and accept that transmission of information over the Internet
          involves inherent risks. To the fullest extent permitted by law, Bharat Connects LLC
          disclaims liability for unauthorized access to or interception of your data that occurs
          despite our reasonable security measures.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your personal information for as long as reasonably necessary to (i) provide
          services and maintain your account; (ii) comply with legal, tax, and regulatory
          obligations (typically seven (7) years for financial records); (iii) resolve disputes and
          enforce our agreements; and (iv) protect our legitimate business interests. Upon account
          closure or verified deletion request, we will delete or anonymize your personal
          information within ninety (90) days, except where retention is required or permitted by
          law, or is necessary for the establishment, exercise, or defense of legal claims.
        </p>

        <h2>7. Your Rights and Choices</h2>
        <h3>7.1 Access, Correction, and Deletion</h3>
        <p>
          You have the right to request access to, correction of, or deletion of the personal
          information we hold about you, subject to our legal retention obligations and our right to
          retain information necessary to defend against claims or enforce our agreements.
        </p>
        <h3>7.2 Opt-Out of Marketing</h3>
        <p>
          You may opt out of marketing communications at any time via the unsubscribe link in any
          email or by emailing
          <a href="mailto:privacy@mybharatconnects.com">privacy&#64;mybharatconnects.com</a>.
          Transactional communications related to active services cannot be opted out of.
        </p>
        <h3>7.3 California Residents (CCPA/CPRA)</h3>
        <p>
          California residents have additional rights under the California Consumer Privacy Act
          (CCPA) and California Privacy Rights Act (CPRA), including the right to know, delete,
          correct, and opt-out of the sale or sharing of personal information. We do not sell
          personal information. To exercise these rights, contact us at
          <a href="mailto:privacy@mybharatconnects.com">privacy&#64;mybharatconnects.com</a>.
        </p>
        <h3>7.4 Exercising Your Rights</h3>
        <p>
          Please contact us at
          <a href="mailto:privacy@mybharatconnects.com">privacy&#64;mybharatconnects.com</a>. We
          will respond within a reasonable timeframe as required by applicable law. We may require
          identity verification. We reserve the right to decline requests that are excessive,
          unfounded, or that would infringe on the rights of others.
        </p>

        <h2>8. Cookies and Tracking Technologies</h2>
        <p>Our website uses cookies and similar tracking technologies:</p>
        <ul>
          <li>
            <strong>Essential Cookies:</strong> Required for the website and portal to function
          </li>
          <li><strong>Analytical Cookies:</strong> Help us understand usage (Google Analytics)</li>
          <li><strong>Marketing Cookies:</strong> Track ad performance and targeted advertising</li>
        </ul>
        <p>
          You can control cookies through your browser settings. Disabling certain cookies may
          affect website functionality.
        </p>

        <h2>9. International Data Transfers</h2>
        <p>
          Bharat Connects LLC operates in the United States. Your information will be transferred to
          and processed by Indian Professionals and Case Managers located in India. By using our
          services, you expressly consent to this cross-border transfer of your information,
          including sensitive personal data. You acknowledge that data protection laws in India may
          differ from those in your country of residence. We ensure adequate protection through
          contractual clauses in all vendor agreements and compliance with applicable US and Indian
          data protection laws, including the Indian Information Technology (Reasonable Security
          Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.
        </p>

        <h2>10. Children's Privacy</h2>
        <p>
          Our services are not directed to individuals under the age of 18. We do not knowingly
          collect personal information from minors. If we discover such information, we will
          promptly delete it.
        </p>

        <h2>11. Third-Party Links</h2>
        <p>
          Our website may contain links to third-party websites. This Privacy Policy does not apply
          to those websites. We are not responsible for the privacy practices, content, or actions
          of any third-party websites.
        </p>

        <h2>12. Limitation of Liability Regarding Data</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, BHARAT CONNECTS LLC, ITS OFFICERS, DIRECTORS,
          EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM ANY UNAUTHORIZED ACCESS, USE,
          DISCLOSURE, ALTERATION, OR DESTRUCTION OF YOUR INFORMATION, WHETHER CAUSED BY THIRD
          PARTIES, INDIAN PROFESSIONALS, CYBER-ATTACKS, OR OTHER CAUSES BEYOND OUR REASONABLE
          CONTROL. OUR AGGREGATE LIABILITY IS LIMITED AS SET FORTH IN OUR TERMS AND CONDITIONS.
        </p>

        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time in our sole discretion. We will notify
          you of material changes by posting the updated policy on our website with a new effective
          date. Your continued use of our services after changes are posted constitutes your
          acceptance of the updated policy.
        </p>

        <h2>14. Governing Law</h2>
        <p>
          This Privacy Policy shall be governed by and construed in accordance with the laws of the
          State of North Carolina, United States, without regard to conflict of law principles. Any
          disputes arising under this Privacy Policy shall be subject to the dispute resolution
          provisions set forth in our Terms and Conditions.
        </p>

        <h2>15. Contact Us</h2>
        <p>
          If you have questions, concerns, or requests regarding this Privacy Policy, please contact
          us:
        </p>
        <p>
          Bharat Connects LLC &mdash; Privacy Officer<br />
          Email: <a href="mailto:privacy@mybharatconnects.com">privacy&#64;mybharatconnects.com</a
          ><br />
          Website: www.mybharatconnects.com/privacy<br />
          Address: 4030 Wake Forest Rd Ste 349, Raleigh 27609, NC
        </p>
      </div>

    </div>
    <app-footer />
  `,
})
export class PrivacyComponent {
  constructor(title: Title) {
    title.setTitle('Privacy Policy — MyBharatConnects');
  }
}
