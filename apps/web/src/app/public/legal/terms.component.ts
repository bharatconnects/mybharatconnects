import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar.component';
import { FooterComponent } from '../shared/footer.component';

@Component({
  selector: 'app-terms',
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
      .doc ul,
      .doc ol {
        margin: 0 0 12px 20px;
        padding: 0;
      }
      .doc ul li,
      .doc ol li {
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
        <h1>Terms &amp; Conditions</h1>
        <p class="meta">
          Bharat Connects LLC &nbsp;|&nbsp; Effective Date: July 14, 2026 &nbsp;|&nbsp;
          <a href="mailto:legal@mybharatconnects.com">legal&#64;mybharatconnects.com</a>
        </p>
        <h2>1. Definitions</h2>
        <p>In these Terms and Conditions:</p>
        <ul>
          <li>
            <strong
              >&lsquo;Company,&rsquo; &lsquo;Bharat Connects,&rsquo; &lsquo;we,&rsquo;
              &lsquo;us,&rsquo; or &lsquo;our&rsquo;</strong
            >
            means Bharat Connects LLC, a limited liability company organized under the laws of the
            State of North Carolina, United States.
          </li>
          <li>
            <strong>&lsquo;Client&rsquo; or &lsquo;you&rsquo;</strong> means any individual who
            accesses our website or engages our services.
          </li>
          <li>
            <strong>&lsquo;Services&rsquo;</strong> means the administrative and coordination
            services offered by Bharat Connects LLC, as described in Section 4.
          </li>
          <li>
            <strong>&lsquo;Indian Professional&rsquo;</strong> means any independent Indian
            third-party service provider (Chartered Accountant, advocate, care agency,
            SEBI-registered advisor, IRDA-licensed agent, Indian-licensed real estate broker, or
            Indian property manager) whom Bharat Connects LLC facilitates on the Client&rsquo;s
            behalf.
          </li>
          <li>
            <strong>&lsquo;Case Manager&rsquo;</strong> means a Bharat Connects LLC employed or
            contracted representative responsible for coordinating your service engagement.
          </li>
          <li>
            <strong>&lsquo;Client Portal&rsquo;</strong> means the secure online platform through
            which clients access and monitor their services.
          </li>
          <li>
            <strong>&lsquo;Service Agreement&rsquo;</strong> means the specific service engagement
            letter for a particular engagement.
          </li>
          <li>
            <strong>&lsquo;Service Fee&rsquo;</strong> means the flat, non-transaction-contingent
            fee charged by Bharat Connects LLC for its administrative and coordination services,
            denominated in US Dollars.
          </li>
          <li>
            <strong>&lsquo;Force Majeure Event&rsquo;</strong> shall have the meaning set forth in
            Section 10.3.
          </li>
        </ul>

        <h2>2. The Managed Services Model</h2>
        <h3>2.1 Nature of Our Services</h3>
        <p>
          Bharat Connects LLC provides administrative, coordination, and case-management services to
          Non-Resident Indians (NRIs) residing in the United States who wish to obtain independent
          professional services located in India. We do NOT act as: a marketplace; broker or agent
          (real estate, insurance, investment, or otherwise) in the United States or India; an
          employer of, partner with, or joint venturer with any Indian Professional; a licensed
          professional in any regulated field; or a fiduciary. Our role is limited to
          administration, facilitation, and workflow management. All licensed professional services
          are performed by independent Indian Professionals under Indian law, whom the Client is
          deemed to have separately retained through our facilitation.
        </p>
        <h3>2.2 Independent Contractor Relationship</h3>
        <p>
          Indian Professionals engaged through our facilitation are independent contractors of the
          Client, not employees, agents, partners, joint venturers, or representatives of Bharat
          Connects LLC. Bharat Connects LLC does not warrant, endorse, guarantee, or supervise the
          professional acts, omissions, advice, or work product of any Indian Professional, and
          shall not be liable for any independent professional errors, malpractice, negligence,
          misconduct, or non-performance of Indian Professionals.
        </p>
        <div class="notice">
          <strong>Our Legal Role:</strong> Bharat Connects LLC is a US-based administrative services
          company. We do not perform licensed activity in the United States or in India. Your legal
          relationship with Bharat Connects LLC is limited to receiving administrative and
          coordination services. Your legal relationship with any licensed professional service is
          directly between you and the Indian Professional.
        </div>

        <h2>3. Service Engagement Process</h2>
        <h3>3.1 Step-by-Step Process</h3>
        <ol>
          <li>You submit a service request through our website intake form</li>
          <li>
            Your Case Manager will contact you within a reasonable time to discuss your requirements
          </li>
          <li>Case Manager obtains quotes from Indian Professionals and evaluates options</li>
          <li>
            Case Manager presents a service proposal including scope, timeline, and Service Fee
          </li>
          <li>You confirm the engagement and a service order is created</li>
          <li>You sign the Service Agreement electronically and authorize payment</li>
          <li>Case Manager facilitates the retention of an Indian Professional</li>
          <li>Indian Professional requests required documents through your Case Manager</li>
          <li>You upload required documents securely through the Client Portal</li>
          <li>
            Indian Professional delivers the service; work product is made available in your portal
          </li>
          <li>You review and approve the deliverable through the portal</li>
          <li>Upon your approval, final payment is captured and invoice issued</li>
        </ol>
        <h3>3.2 Communication Protocol</h3>
        <p>
          All communications regarding your service must flow through your assigned Case Manager.
          This protocol exists to protect confidentiality, maintain quality oversight, and preserve
          records. Any violation of this protocol may result in immediate suspension or termination
          of services without refund and without further liability to Bharat Connects LLC. You
          further agree to indemnify Bharat Connects LLC against any claims, losses, or liabilities
          arising from any direct communication or engagement you initiate with an Indian
          Professional outside our protocol.
        </p>
        <h3>3.3 Electronic Signature and E-SIGN Consent</h3>
        <p>
          You expressly consent to conduct business with Bharat Connects LLC electronically, and
          agree that electronic acceptance of these Terms, click-through consent, and electronic
          signatures on Service Agreements have the same legal force and effect as handwritten
          signatures under the U.S. Electronic Signatures in Global and National Commerce Act
          (E-SIGN), the Uniform Electronic Transactions Act (UETA), and any equivalent applicable
          law. You may withdraw this consent by discontinuing use of our services and notifying us
          in writing at legal&#64;mybharatconnects.com.
        </p>

        <h2>4. Services Offered</h2>
        <h3>4.1 Tax Filing Coordination</h3>
        <p>
          Bharat Connects LLC facilitates the engagement of Indian Chartered Accountants (registered
          with the Institute of Chartered Accountants of India) for Indian income tax return (ITR)
          filing, advance tax, TDS refund claims, foreign income declaration, and DTAA benefit
          applications. Bharat Connects LLC does NOT prepare, sign, review, or issue tax filings.
          The Chartered Accountant-client relationship is directly between you and the Indian
          Chartered Accountant. Any delays, penalties, interest, or adverse tax consequences arising
          from client-caused delays, incomplete information, misrepresentation, professional advice
          given by the Chartered Accountant, or government processing delays are not the
          responsibility of Bharat Connects LLC.
        </p>
        <h3>4.2 Legal Documentation Coordination</h3>
        <p>
          We facilitate the engagement of registered Indian advocates for Power of Attorney drafting
          and notarization, affidavit preparation, property-related documentation, OCI/PIO services,
          Will drafting, and other NRI-specific legal documentation for use in India.
        </p>
        <p>
          BHARAT CONNECTS LLC IS NOT A LAW FIRM, DOES NOT PRACTICE LAW IN ANY JURISDICTION, DOES NOT
          PROVIDE LEGAL ADVICE, AND DOES NOT REPRESENT CLIENTS IN ANY LEGAL CAPACITY. The
          attorney-client relationship is directly between you and the Indian advocate. Bharat
          Connects LLC bears no liability for the correctness, sufficiency, admissibility, or
          consequences of any legal advice, document, or work product.
        </p>
        <h3>4.3 Elder Care Coordination</h3>
        <p>
          We facilitate the engagement of Indian home care agencies and individual caregivers to
          provide in-home nursing, medical escort services, hospital liaison, medication management,
          and companionship visits for the Client&rsquo;s elderly dependents residing in India.
        </p>
        <p>
          BHARAT CONNECTS LLC IS NOT A HEALTHCARE PROVIDER, HOME HEALTH AGENCY, OR CAREGIVER, AND
          DOES NOT PROVIDE MEDICAL ADVICE, TREATMENT, OR DIAGNOSIS. The caregiver-patient
          relationship is directly between the care provider and your dependent. In case of medical
          emergencies, local Indian emergency services should be contacted directly. Bharat Connects
          LLC shall not be liable for any injury, illness, death, financial loss, or damages arising
          from the acts, omissions, negligence, or misconduct of any care provider, or from any
          medical outcome.
        </p>
        <h3>4.4 Investment / Insurance Coordination</h3>
        <p>
          We facilitate the engagement of SEBI-registered Investment Advisors and IRDA-licensed
          insurance agents in India to advise on and execute NRI mutual fund investments, NRE/NRO
          fixed deposit setup, Indian insurance policies, repatriation assistance, and FEMA-related
          matters.
        </p>
        <p>
          BHARAT CONNECTS LLC IS NOT AN INVESTMENT ADVISOR, FINANCIAL ADVISOR, BROKER-DEALER, OR
          INSURANCE AGENT IN THE UNITED STATES OR INDIA, IS NOT REGISTERED WITH THE SEC, FINRA, ANY
          STATE INSURANCE COMMISSIONER, SEBI, OR IRDAI, AND DOES NOT PROVIDE FINANCIAL, TAX, OR
          INVESTMENT ADVICE. Nothing on our website constitutes a solicitation of any security,
          insurance product, or investment. All investment and insurance decisions are made at your
          own risk.
        </p>
        <h3>4.5 Real Estate Administrative Coordination Services (India-Located Property Only)</h3>
        <p>
          Bharat Connects LLC facilitates the engagement of Indian-licensed real estate brokers,
          advocates, and property management firms to assist NRI clients with property matters
          concerning real property located in the Republic of India, including: (a) administrative
          coordination of documentation for sale or purchase transactions; (b) coordination of
          title-search, encumbrance certificate, and due-diligence activities performed by Indian
          professionals; (c) coordination of property registration, stamp duty payment, and
          municipal formalities in India; (d) administrative coordination of rental management,
          tenant coordination, maintenance oversight, and rent collection performed by Indian
          property managers.
        </p>
        <p>
          BHARAT CONNECTS LLC IS NOT A LICENSED REAL ESTATE BROKER, SALESPERSON, REAL ESTATE AGENT,
          OR PROPERTY MANAGER IN NORTH CAROLINA OR ANY OTHER US STATE OR JURISDICTION. BHARAT
          CONNECTS LLC DOES NOT: (i) SOLICIT, NEGOTIATE, LIST, PROCURE, OR CLOSE US REAL ESTATE
          TRANSACTIONS; (ii) SHOW OR MARKET US PROPERTY; (iii) HOLD ITSELF OUT AS A US BROKER OR
          AGENT; (iv) HANDLE ESCROW, CLIENT TRUST FUNDS, OR EARNEST MONEY; (v) PROVIDE US REAL
          ESTATE ADVICE, VALUATIONS, OR OPINIONS OF VALUE; OR (vi) PROVIDE ANY SERVICE THAT WOULD
          REQUIRE A REAL ESTATE LICENSE IN ANY US JURISDICTION.
        </p>
        <h3>4.5.2 Service Fee Structure &mdash; Non-Transaction-Contingent</h3>
        <p>
          The Service Fee for real estate coordination is a FLAT ADMINISTRATIVE FEE. It is NOT a
          commission, is NOT contingent upon the closing, sale price, purchase price, or execution
          of any real estate transaction, and is NOT calculated as a percentage of any transaction
          value. Bharat Connects LLC does not receive, accept, or split any commission, referral
          fee, kickback, or any other consideration from any Indian real estate broker or from any
          US mortgage lender in connection with any transaction.
        </p>

        <h2>5. Fees, Payment, and Billing</h2>
        <h3>5.1 Service Fees</h3>
        <p>
          All Service Fees are agreed upon at the time of service confirmation and denominated in US
          Dollars (USD). All Service Fees are flat administrative fees, are NOT contingent upon
          transaction outcome, and are exclusive of applicable taxes, government fees, stamp duties,
          registration charges, third-party costs, and Indian Professional fees, all of which are
          the sole responsibility of the Client.
        </p>
        <h3>5.2 Payment Terms</h3>
        <ul>
          <li>
            <strong>Payment Authorization:</strong> Upon service confirmation, you irrevocably
            authorize Bharat Connects LLC to place a temporary hold on your payment method for the
            full Service Fee amount, to capture such amount upon your approval of the completed
            service deliverable, and to make reasonable re-attempts if the payment method initially
            declines.
          </li>
          <li>
            <strong>Payment Capture:</strong> The authorized amount is captured upon your approval
            of the completed service deliverable, or if you fail to affirmatively reject the
            deliverable within seven (7) days of delivery through the Client Portal.
          </li>
          <li>
            <strong>Accepted Payment Methods:</strong> All major credit and debit cards processed
            via Stripe. No cash, cheque, wire transfer, cryptocurrency, or other payment methods are
            accepted.
          </li>
          <li>
            <strong>Payment Disputes / Chargebacks:</strong> You agree to raise any billing dispute
            in good faith with Bharat Connects LLC first before initiating any chargeback.
            Unauthorized chargebacks may result in immediate account termination and pursuit of
            collection remedies.
          </li>
        </ul>
        <h3>5.3 Refund and Cancellation Policy</h3>
        <p><strong>Prior to Indian Professional assignment:</strong> refund of amounts paid less a non-refundable USD $15 processing fee. <strong>After Indian Professional assignment:</strong> no refunds shall be issued for any reason. Service failures attributable to Bharat Connects LLC are addressed exclusively by complimentary re-service subject to Section 5.4.</p>
        <h3>5.4 Exclusions from Complimentary Re-Service</h3>
        <p>
          The complimentary re-service remedy shall NOT apply to failures, delays, or unfavorable
          outcomes caused by: any act, policy, rule, regulation, ruling, decision, delay, or
          inaction of any government, tax authority, court, or regulator; changes in law,
          regulation, taxation, RERA, FEMA, or RBI policy; Force Majeure Events; delays or errors by
          third parties not engaged by Bharat Connects LLC; client-caused delays, incomplete or
          inaccurate information, or non-response; independent professional judgment or work product
          of any Indian Professional; adverse market conditions; or any circumstance beyond the
          reasonable control of Bharat Connects LLC.
        </p>

        <h2>6. Client Obligations</h2>
        <p>The Client agrees, at their sole cost and risk, to:</p>
        <ul>
          <li>Provide accurate, complete, current, and truthful information at all stages</li>
          <li>Respond to Case Manager communications within a reasonable time</li>
          <li>Upload all requested documents through the Client Portal in a timely manner</li>
          <li>Review service deliverables and provide approval or feedback in a timely manner</li>
          <li>
            Maintain the confidentiality of Client Portal login credentials and be solely
            responsible for all activity under the account
          </li>
          <li>
            Not circumvent the Case Manager communication protocol or contact Indian Professionals
            directly
          </li>
          <li>
            Notify Bharat Connects LLC promptly of any changes to instructions or circumstances
          </li>
          <li>
            Comply with all applicable US, Indian, and other relevant laws, including FEMA, US
            foreign asset reporting, and tax laws
          </li>
          <li>
            Consult independently with US CPAs, US attorneys, and other US-licensed advisors
            regarding US tax, legal, and regulatory implications of engaging our services
          </li>
          <li>
            Indemnify Bharat Connects LLC against any loss arising from your breach of any of the
            above obligations
          </li>
        </ul>

        <h2>7. Intellectual Property</h2>
        <p>
          All content on the Bharat Connects LLC website, including text, graphics, logos, images,
          service descriptions, workflows, methodologies, evaluation scorecards, software, and
          underlying source code, is the exclusive property of Bharat Connects LLC or its licensors
          and is protected by US and international intellectual property laws. Unauthorized use,
          reproduction, modification, distribution, reverse engineering, or creation of derivative
          works is strictly prohibited and may result in civil and criminal penalties.
        </p>

        <h2>8. Confidentiality</h2>
        <p>
          Both parties agree to maintain the confidentiality of all non-public information shared
          during the engagement. Bharat Connects LLC will not disclose your personal or financial
          information to any third party except as described in our Privacy Policy or as required or
          permitted by law. You agree to maintain the confidentiality of any proprietary processes,
          workflows, Indian Professional identities, pricing, or non-public business information of
          Bharat Connects LLC. Breach entitles Bharat Connects LLC to injunctive relief in addition
          to any other available remedies.
        </p>

        <h2>9. Representations, Warranties, and Disclaimers</h2>
        <h3>9.1 Your Representations</h3>
        <p>
          You represent and warrant that: (i) you are at least eighteen (18) years of age with full
          legal capacity; (ii) all information provided by you is true, accurate, and complete;
          (iii) you have all necessary rights and authority to engage our services and to authorize
          any transaction contemplated hereunder; (iv) your use of our services will not violate any
          applicable law or third-party right; (v) you are not on any US Office of Foreign Assets
          Control (OFAC) sanctions or restricted persons list, nor a national of any US-embargoed
          jurisdiction; and (vi) any real property that is the subject of real estate coordination
          services is located in the Republic of India.
        </p>
        <h3>9.2 Service Warranty Disclaimer</h3>
        <p>
          OUR SERVICES ARE PROVIDED ON AN &lsquo;AS IS&rsquo; AND &lsquo;AS AVAILABLE&rsquo; BASIS.
          TO THE FULLEST EXTENT PERMITTED BY LAW, BHARAT CONNECTS LLC EXPRESSLY DISCLAIMS ALL
          WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT
          LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
          NON-INFRINGEMENT, ACCURACY, RELIABILITY, TIMELINESS, OR ANY WARRANTY ARISING FROM COURSE
          OF DEALING OR TRADE USAGE. WE DO NOT WARRANT THAT OUR WEBSITE OR SERVICES WILL BE
          UNINTERRUPTED, ERROR-FREE, OR SECURE.
        </p>
        <h3>9.3 No Reliance</h3>
        <p>
          You acknowledge that in agreeing to these Terms and engaging our services, you are not
          relying on any statement, representation, warranty, or assurance of Bharat Connects LLC,
          our Case Managers, our website, our marketing materials, or any third party, other than as
          expressly set forth in these Terms and your Service Agreement.
        </p>
        <h3>9.4 Right to Substitute Indian Professional</h3>
        <p>
          Bharat Connects LLC reserves the right, in its sole discretion, to substitute the assigned
          Indian Professional at any time before or during service delivery, without prior notice
          and without liability, in the event of Indian Professional unavailability,
          non-performance, conflict of interest, or for any other reason we deem appropriate.
          Substitution shall not be a service failure and shall not entitle the Client to any
          refund, credit, or re-service.
        </p>

        <h2>10. Limitation of Liability and Indemnification</h2>
        <h3>10.1 Limitation of Liability</h3>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL BHARAT CONNECTS LLC,
          ITS OFFICERS, DIRECTORS, MEMBERS, EMPLOYEES, AGENTS, AFFILIATES, OR LICENSORS BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES,
          INCLUDING LOSS OF INCOME, PROFITS, BUSINESS OPPORTUNITY, DATA, GOODWILL, INVESTMENT
          RETURNS, PROPERTY VALUE, RENTAL INCOME, OR TAX REFUNDS, ARISING OUT OF OR RELATED TO YOUR
          USE OF OUR WEBSITE, SERVICES, OR ANY INDIAN PROFESSIONAL&rsquo;S ACTIONS OR OMISSIONS,
          WHETHER BASED ON CONTRACT, TORT, STRICT LIABILITY, OR ANY OTHER THEORY, EVEN IF ADVISED OF
          THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ANY AND ALL CLAIMS SHALL NOT EXCEED THE GREATER
          OF (A) THE ACTUAL SERVICE FEES PAID BY YOU TO BHARAT CONNECTS LLC FOR THE SPECIFIC SERVICE
          GIVING RISE TO THE CLAIM DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) USD
          $500.
        </p>
        <h3>10.2 Indemnification by Client</h3>
        <p>
          You agree to defend, indemnify, and hold harmless Bharat Connects LLC, its officers,
          directors, members, employees, agents, affiliates, Case Managers, and Indian Professionals
          from and against any and all claims, damages, obligations, losses, liabilities, costs, and
          expenses (including reasonable attorney&rsquo;s fees) arising out of or related to: (i)
          your use of our website or services; (ii) your violation of these Terms; (iii) your
          violation of any third-party right; (iv) your acts causing damage to a third party; (v)
          inaccurate or misleading information you provide; (vi) your direct communication with an
          Indian Professional in violation of Section 3.2; (vii) any US or Indian regulatory action
          arising from your failure to comply with tax, FEMA, US reporting, or other applicable
          laws; and (viii) any claim by any tenant, buyer, seller, family member, or other third
          party arising from any real estate coordination service.
        </p>
        <h3>10.3 Force Majeure</h3>
        <p>
          Bharat Connects LLC shall not be liable for any delay, failure, or non-performance caused
          by circumstances beyond our reasonable control, including but not limited to: acts of God;
          natural disasters; acts of government or regulatory bodies (including changes in law,
          regulation, taxation, sanctions, or public policy, including RBI, FEMA, RERA, or SEBI
          actions); acts of war, terrorism, or civil unrest; internet or power outages;
          cyber-attacks; delays or refusals by any government agency, court, registrar, or
          regulatory body; delays by third-party service providers, banks, or counterparties; or any
          other circumstance beyond our reasonable control. During any Force Majeure Event,
          performance obligations shall be suspended without liability, and you shall have no right
          to a refund, credit, re-service, or any other remedy.
        </p>

        <h2>11. Dispute Resolution</h2>
        <h3>11.1 Informal Resolution (Mandatory)</h3>
        <p>
          Before initiating any formal proceeding, you agree to contact Bharat Connects LLC in
          writing at legal&#64;mybharatconnects.com and provide a detailed description of the
          dispute, and to allow thirty (30) days for good-faith informal resolution. This informal
          resolution period is a mandatory precondition to any arbitration or court proceeding.
        </p>
        <h3>11.2 Binding Arbitration</h3>
        <p>
          If informal resolution fails, any and all disputes, claims, or controversies arising out
          of or relating to these Terms, our services, or our relationship shall be resolved
          exclusively by final and binding arbitration administered by the American Arbitration
          Association (AAA) under its Commercial Arbitration Rules then in effect. The arbitration
          shall be conducted by a single arbitrator in Charlotte, North Carolina, or by video
          conference at the arbitrator&rsquo;s election. The arbitrator&rsquo;s award shall be final
          and binding, and judgment may be entered in any court of competent jurisdiction. This
          arbitration provision shall be governed by the Federal Arbitration Act (9 U.S.C. &sect; 1
          et seq.).
        </p>
        <h3>11.3 Small Claims Carve-Out</h3>
        <p>
          Notwithstanding Section 11.2, either party may bring an individual action in small claims
          court in Mecklenburg County, North Carolina, for disputes within that court&rsquo;s
          jurisdictional limits, provided the action remains in small claims court.
        </p>
        <h3>11.4 Class Action Waiver</h3>
        <p>
          YOU AND BHARAT CONNECTS LLC EACH AGREE THAT ANY PROCEEDINGS TO RESOLVE DISPUTES SHALL BE
          CONDUCTED SOLELY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, COLLECTIVE, CONSOLIDATED,
          MASS, PRIVATE ATTORNEY GENERAL, OR REPRESENTATIVE ACTION. YOU EXPRESSLY WAIVE ANY RIGHT TO
          PARTICIPATE IN ANY CLASS OR REPRESENTATIVE PROCEEDING AGAINST BHARAT CONNECTS LLC.
        </p>
        <h3>11.5 Jury Trial Waiver</h3>
        <p>
          IF ANY DISPUTE PROCEEDS IN COURT DESPITE THE ARBITRATION PROVISION, EACH PARTY EXPRESSLY
          WAIVES ANY RIGHT TO A TRIAL BY JURY AND CONSENTS TO A BENCH TRIAL BEFORE A JUDGE.
        </p>
        <h3>11.6 Limitation Period</h3>
        <p>
          Any dispute must be filed within ONE (1) YEAR after the cause of action arose. If not
          filed within this period, the dispute is permanently barred and waived.
        </p>
        <h3>11.7 Governing Law and Jurisdiction</h3>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of
          North Carolina, without regard to conflict of law principles. Subject to the arbitration
          provisions above, the state and federal courts located in Mecklenburg County, North
          Carolina shall have exclusive jurisdiction over any dispute not subject to arbitration.
        </p>
        <h3>11.8 Injunctive Relief</h3>
        <p>
          Notwithstanding the arbitration provision, Bharat Connects LLC may seek injunctive or
          other equitable relief in any court of competent jurisdiction to protect its intellectual
          property, confidential information, or to enforce this Agreement, without the requirement
          of posting bond.
        </p>

        <h2>12. Account Termination</h2>
        <p>
          Bharat Connects LLC reserves the right, in its sole discretion, to suspend or terminate
          your account and access to services at any time, with or without notice, for any reason
          including: breach of these Terms or our Privacy Policy; fraudulent, misleading, or
          inaccurate information; direct communication with Indian Professionals in violation of our
          protocol; non-payment of outstanding Service Fees; abusive, harassing, or unlawful
          conduct; chargeback initiated without prior good-faith dispute; or any conduct posing a
          legal, reputational, or operational risk to Bharat Connects LLC.
        </p>

        <h2>13. Modifications to Terms</h2>
        <p>
          Bharat Connects LLC reserves the right, in its sole discretion, to modify these Terms at
          any time by posting the revised Terms on our website. Material changes will be
          communicated by email or portal notice. Your continued use of our website or services
          after the effective date of the revised Terms constitutes your acceptance of the modified
          Terms.
        </p>

        <h2>14. Assignment</h2>
        <p>
          You may not assign, transfer, or delegate any of your rights or obligations under these
          Terms without our prior written consent. Any purported unauthorized assignment is void.
          Bharat Connects LLC may freely assign, transfer, or delegate these Terms, in whole or in
          part, without your consent, including in connection with any merger, acquisition, sale of
          assets, or reorganization.
        </p>

        <h2>15. Severability, Waiver, and Interpretation</h2>
        <p>
          If any provision of these Terms is held invalid, illegal, or unenforceable, such provision
          shall be modified to the minimum extent necessary to make it enforceable, and the
          remaining provisions shall continue in full force. No failure or delay by Bharat Connects
          LLC to exercise any right constitutes a waiver. These Terms shall be construed neutrally,
          and no presumption shall apply against the drafter.
        </p>

        <h2>16. Entire Agreement</h2>
        <p>
          These Terms and Conditions, together with our Privacy Policy and any executed Service
          Agreement, constitute the entire agreement between you and Bharat Connects LLC and
          supersede all prior agreements, representations, understandings, and communications,
          whether written or oral.
        </p>

        <h2>17. Contact Information</h2>
        <p>
          Bharat Connects LLC &mdash; Legal Department<br />
          Email: <a href="mailto:legal@mybharatconnects.com">legal&#64;mybharatconnects.com</a
          ><br />
          Website: www.mybharatconnects.com/terms<br />
          Address: 4030 Wake Forest Rd Ste 349, Raleigh 27609, NC
        </p>
        <div class="notice" style="margin-top:24px">
          <strong>Acknowledgment:</strong> By using our website or engaging our services, you
          acknowledge that you have read, understood, and agree to be legally bound by these Terms
          and Conditions and our Privacy Policy in their entirety, including the arbitration, class
          action waiver, jury trial waiver, limitation of liability, and no-refund provisions.
        </div>
      </div>

    </div>
    <app-footer />
  `,
})
export class TermsComponent {
  constructor(title: Title) {
    title.setTitle('Terms & Conditions — MyBharatConnects');
  }
}
