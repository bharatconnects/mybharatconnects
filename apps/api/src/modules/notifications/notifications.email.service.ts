import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import * as https from 'https';
import { generateUnsubscribeToken } from '../../common/utils/unsubscribe-token.util';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: SESv2Client | null;
  private readonly fromAddress: string;
  private readonly isDevMode: boolean;
  private readonly recipientOverride: string | null;
  private readonly frontendUrl: string;
  private readonly unsubscribeSecret: string;

  constructor(private readonly config: ConfigService) {
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
    // Reuses JWT_SECRET (already required + length-validated at boot by
    // AuthModule) rather than adding a dedicated env var for this.
    this.unsubscribeSecret = config.get<string>('JWT_SECRET') ?? '';

    const region = config.get<string>('AWS_REGION') ?? 'ap-south-1';
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '';
    const fromEmail =
      config.get<string>('SES_FROM_EMAIL') ?? 'noreply@mybharatconnects.com';
    const fromName = config.get<string>('SES_FROM_NAME') ?? 'MyBharatConnects';
    this.fromAddress = `${fromName} <${fromEmail}>`;

    // SES sandbox: all outgoing emails are redirected to this address.
    // Remove once SES production access is granted.
    this.recipientOverride =
      config.get<string>('SES_TEST_RECIPIENT_OVERRIDE') ?? null;

    const emailEnabled = config.get<string>('EMAIL_ENABLED') === 'true';
    this.isDevMode = !emailEnabled;

    // Static keys are only used when explicitly set and not the .env.example
    // placeholder (local dev against a real SES sender with a personal IAM
    // user). In production, no keys are set — omitting `credentials` lets
    // the AWS SDK's default provider chain pick up the ECS task role
    // automatically, instead of the broad, long-lived AmazonSESFullAccess
    // key this used to require.
    const hasExplicitKeys =
      !!accessKeyId &&
      !accessKeyId.startsWith('replace') &&
      !!secretAccessKey &&
      !secretAccessKey.startsWith('replace');

    if (this.isDevMode) {
      this.client = null;
      this.logger.warn(
        'EMAIL_ENABLED=false — email sending disabled (sends will be logged only).',
      );
    } else {
      // The local machine's CA store isn't always trusted by AWS's SDK in
      // dev. Only bypass TLS verification outside production — never in prod.
      const isProduction = config.get<string>('NODE_ENV') === 'production';
      const clientConfig: ConstructorParameters<typeof SESv2Client>[0] = {
        region,
        ...(hasExplicitKeys
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      };
      if (!isProduction) {
        clientConfig.requestHandler = new NodeHttpHandler({
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        });
      }
      this.client = new SESv2Client(clientConfig);
    }
  }

  private async send(msg: EmailMessage): Promise<void> {
    if (this.isDevMode || !this.client) {
      this.logger.log(`[DEV EMAIL] To: ${msg.to} | Subject: ${msg.subject}`);
      return;
    }
    const actualTo = this.recipientOverride ?? msg.to;
    if (this.recipientOverride) {
      this.logger.log(
        `[SES OVERRIDE] Redirecting email from ${msg.to} → ${actualTo} | Subject: ${msg.subject}`,
      );
    }
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: this.fromAddress,
          Destination: { ToAddresses: [actualTo] },
          Content: {
            Simple: {
              Subject: { Data: msg.subject, Charset: 'UTF-8' },
              Body: { Html: { Data: msg.html, Charset: 'UTF-8' } },
            },
          },
        }),
      );
    } catch (err) {
      this.logger.error(`SES send error to ${msg.to}`, err);
      throw err;
    }
  }

  private wrap(body: string): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f5f0e6;font-family:Arial,Helvetica,sans-serif;color:#0f1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="580" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f1a2e;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                MyBharatConnects
              </span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#faf6ed;border-top:1px solid #ddd5c5;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 6px;color:#6b7280;font-size:12px;">
                Need help? Email us at
                <a href="mailto:info@mybharatconnects.com"
                   style="color:#d97706;text-decoration:none;">info@mybharatconnects.com</a>
              </p>
              <p style="margin:0;color:#9ca3af;font-size:11px;">
                &copy; ${year} MyBharatConnects. All rights reserved.<br/>
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private greeting(name: string): string {
    return `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f1a2e;">Hi ${name},</p>`;
  }

  private unsubscribeFooter(userId: string): string {
    const token = generateUnsubscribeToken(userId, this.unsubscribeSecret);
    const link = `${this.frontendUrl}/unsubscribe?u=${userId}&t=${token}`;
    return `<p style="margin:20px 0 0;color:#9ca3af;font-size:11px;">
      <a href="${link}" style="color:#9ca3af;">Unsubscribe from these emails</a>
    </p>`;
  }

  private button(label: string, href: string): string {
    return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
      <tr>
        <td style="background-color:#d97706;border-radius:6px;">
          <a href="${href}"
             style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
  }

  async sendOtpEmail(to: string, otp: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Login OTP – MyBharatConnects',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          Use the OTP below to complete your login. It is valid for <strong>10 minutes</strong>
          and can only be used once.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 24px;">
          <tr>
            <td style="background-color:#fdf8ee;border:2px dashed #e8c97a;border-radius:8px;padding:16px 40px;text-align:center;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#d97706;">${otp}</span>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          If you did not request this OTP, please ignore this email or contact support immediately.
          Never share your OTP with anyone — our team will never ask for it.
        </p>
      `),
    });
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    role: string,
  ): Promise<void> {
    const displayRole = role
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    await this.send({
      to,
      subject: 'Welcome to MyBharatConnects!',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 16px;color:#374151;">
          Welcome aboard! Your <strong>MyBharatConnects</strong> account has been created successfully.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 20px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Account Email</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${to}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Role</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${displayRole}</td>
          </tr>
        </table>
        <p style="margin:0 0 8px;color:#374151;">
          You can log in using your registered email address. For security, every login
          requires a one-time password sent to this email.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          If you did not create this account, please contact us immediately at
          <a href="mailto:info@mybharatconnects.com" style="color:#d97706;text-decoration:none;">info@mybharatconnects.com</a>.
        </p>
      `),
    });
  }

  async sendCaseUpdateEmail(
    to: string,
    name: string,
    caseNumber: string,
    newStatus: string,
  ): Promise<void> {
    const displayStatus = newStatus
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    await this.send({
      to,
      subject: `Update on Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          There has been an update to your case. Here are the latest details:
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Case Number</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${caseNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">New Status</td>
            <td style="text-align:right;padding-top:8px;">
              <span style="background:#fdf8ee;color:#d97706;font-size:12px;font-weight:600;
                           padding:3px 10px;border-radius:12px;">${displayStatus}</span>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Log in to your dashboard to view full case details and any required actions.
        </p>
      `),
    });
  }

  async sendQuoteEmail(
    to: string,
    name: string,
    caseNumber: string,
    amount: number,
  ): Promise<void> {
    const formattedAmount = (amount / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });
    await this.send({
      to,
      subject: `New Quote for Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          A new quote has been prepared for your case. Please review and respond at your earliest convenience.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Case Number</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${caseNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Quoted Amount</td>
            <td style="color:#d97706;font-weight:700;font-size:18px;text-align:right;padding-top:8px;">${formattedAmount}</td>
          </tr>
        </table>
        <p style="margin:0;color:#374151;font-size:14px;">
          Log in to your portal to review the full quote breakdown and accept or request changes.
        </p>
      `),
    });
  }

  async sendPaymentConfirmationEmail(
    to: string,
    name: string,
    amount: number,
    caseNumber: string,
  ): Promise<void> {
    const formattedAmount = (amount / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });
    const date = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    await this.send({
      to,
      subject: `Payment Confirmed – Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          We have received your payment. Thank you! Your transaction details are below.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#15803d;font-size:13px;">Status</td>
            <td style="color:#15803d;font-weight:700;font-size:13px;text-align:right;">&#10003; Payment Confirmed</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Case Number</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${caseNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Amount Paid</td>
            <td style="color:#0f1a2e;font-weight:700;font-size:18px;text-align:right;padding-top:8px;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Date</td>
            <td style="color:#0f1a2e;font-size:13px;text-align:right;padding-top:8px;">${date}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          A receipt is available in your dashboard. If you have any concerns about this transaction,
          please contact us immediately.
        </p>
      `),
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    if (this.isDevMode) {
      this.logger.log(
        `[DEV EMAIL] Password reset link for ${to}: ${resetLink}`,
      );
    }
    await this.send({
      to,
      subject: 'Reset Your Password – MyBharatConnects',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          We received a request to reset the password for your MyBharatConnects account.
          Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
        </p>
        ${this.button('Reset My Password', resetLink)}
        <p style="margin:16px 0 8px;color:#6b7280;font-size:13px;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin:0 0 20px;word-break:break-all;">
          <a href="${resetLink}" style="color:#d97706;font-size:12px;">${resetLink}</a>
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not be changed.
        </p>
      `),
    });
  }

  async sendWelcomePack(
    to: string,
    name: string,
    caseNumber: string,
    caseManagerName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Your Case ${caseNumber} Is Now Open – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 16px;color:#374151;">
          Great news! Your case is now officially open and our team is ready to assist you every step of the way.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Case Number</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${caseNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Your Case Manager</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${caseManagerName}</td>
          </tr>
        </table>
        <p style="margin:0 0 12px;color:#374151;">
          <strong>${caseManagerName}</strong> will be your dedicated point of contact and will be in touch
          shortly with next steps.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Please keep an eye on your inbox for document requests and case updates. You can also
          track progress anytime by logging into your dashboard.
        </p>
      `),
    });
  }

  async sendCaseInitiatedEmail(
    to: string,
    name: string,
    caseNumber: string,
    serviceType: string,
  ): Promise<void> {
    const displayService = serviceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const loginLink = `${this.frontendUrl}/login`;
    await this.send({
      to,
      subject: `Action Needed on Your ${displayService} Case – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 16px;color:#374151;">
          Your case for <strong>${displayService}</strong> has been created and is ready for you
          to review.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Case Number</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${caseNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Service</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${displayService}</td>
          </tr>
        </table>
        <p style="margin:0 0 20px;color:#374151;">
          Sign in to your account to review your case and take the next step.
        </p>
        ${this.button('Sign In', loginLink)}
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
          First time signing in? Use the "Forgot password" link on the sign-in page with this
          email address (${to}) to set your password.
        </p>
      `),
    });
  }

  async sendVendorInviteEmail(
    to: string,
    vendorName: string,
    caseNumber: string,
    serviceType: string,
    options: {
      location?: string;
      serviceRequired?: string;
      respondByDate?: Date;
      cmName?: string;
      cmEmail?: string;
    } = {},
  ): Promise<void> {
    const displayService = serviceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const loginLink = `${this.frontendUrl}/login`;
    const detailRow = (label: string, value: string) => `
      <tr>
        <td style="color:#6b7280;font-size:13px;padding-top:8px;">${label}</td>
        <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${value}</td>
      </tr>`;
    const respondByLine = options.respondByDate
      ? `<p style="margin:0 0 20px;color:#374151;">
          Please submit your quotation by
          <strong>${options.respondByDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} IST</strong>.
        </p>`
      : '';
    const cmLine =
      options.cmName && options.cmEmail
        ? `<strong>${options.cmName}</strong> (<a href="mailto:${options.cmEmail}" style="color:#d97706;">${options.cmEmail}</a>)`
        : 'your My Bharat Connects case manager';

    await this.send({
      to,
      subject: `New Quote Request – Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(vendorName)}
        <p style="margin:0 0 16px;color:#374151;">
          We have received a new client request through My Bharat Connects that falls within
          your area of expertise. We would appreciate your quotation based on the details
          provided below.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 20px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Reference</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${caseNumber}</td>
          </tr>
          ${detailRow('Service Category', displayService)}
          ${options.location ? detailRow('Location', options.location) : ''}
          ${options.serviceRequired ? detailRow('Service Required', options.serviceRequired) : ''}
        </table>
        <p style="margin:0 0 12px;color:#374151;">
          Please provide the following information when you submit your quotation on the platform:
        </p>
        <ol style="margin:0 0 20px;padding-left:20px;color:#374151;">
          <li style="margin-bottom:6px;">Your quotation (including GST, if applicable).</li>
          <li style="margin-bottom:6px;">Detailed scope of services included.</li>
          <li style="margin-bottom:6px;">Any exclusions or assumptions.</li>
          <li style="margin-bottom:6px;">Estimated turnaround time.</li>
          <li style="margin-bottom:6px;">Documents or information required from the client.</li>
          <li style="margin-bottom:6px;">Validity of the quotation.</li>
          <li>Any additional recommendations or observations.</li>
        </ol>
        ${respondByLine}
        <p style="margin:0 0 16px;color:#374151;">
          To ensure a consistent client experience, we request that all communication with the
          client be routed exclusively through My Bharat Connects unless expressly authorized
          otherwise.
        </p>
        <p style="margin:0 0 16px;color:#374151;">
          The client's personal information is intentionally withheld at this stage and will
          only be shared with the selected service partner after the client has accepted the
          quotation and any required engagement formalities have been completed.
        </p>
        <p style="margin:0 0 20px;color:#374151;">
          If you have any questions regarding this request, please contact ${cmLine}.
        </p>
        ${this.button('Sign In to Submit Your Quote', loginLink)}
        <p style="margin:16px 0 0;color:#374151;">
          We appreciate your prompt response and continued partnership.
        </p>
        <p style="margin:8px 0 0;color:#374151;">
          Best regards,<br/>My Bharat Connects
        </p>
      `),
    });
  }

  async sendVendorInviteDeclinedEmail(
    to: string,
    cmName: string,
    vendorName: string,
    caseNumber: string,
    reason: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Vendor Declined Quote Request – Case ${caseNumber}`,
      html: this.wrap(`
        ${this.greeting(cmName)}
        <p style="margin:0 0 16px;color:#374151;">
          <strong>${vendorName}</strong> has declined the quote request for case
          <strong>${caseNumber}</strong>.
        </p>
        <p style="margin:0 0 20px;color:#374151;">Reason: ${reason}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          You may want to invite another vendor to quote on this case.
        </p>
      `),
    });
  }

  async sendQuoteInfoRequestEmail(
    to: string,
    cmName: string,
    vendorName: string,
    caseNumber: string,
    note: string,
  ): Promise<void> {
    const loginLink = `${this.frontendUrl}/login`;
    await this.send({
      to,
      subject: `Vendor Question – Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(cmName)}
        <p style="margin:0 0 16px;color:#374151;">
          <strong>${vendorName}</strong> asked a question before quoting on case
          <strong>${caseNumber}</strong>:
        </p>
        <p style="margin:0 0 20px;color:#374151;background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:12px 16px;">
          ${note}
        </p>
        ${this.button('Answer Question', loginLink)}
      `),
    });
  }

  async sendQuoteInfoAnsweredEmail(
    to: string,
    vendorName: string,
    caseNumber: string,
    answer: string,
  ): Promise<void> {
    const loginLink = `${this.frontendUrl}/login`;
    await this.send({
      to,
      subject: `Your Question Was Answered – Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(vendorName)}
        <p style="margin:0 0 16px;color:#374151;">
          The case manager answered your question about case <strong>${caseNumber}</strong>:
        </p>
        <p style="margin:0 0 20px;color:#374151;background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:12px 16px;">
          ${answer}
        </p>
        ${this.button('Submit Your Quote', loginLink)}
      `),
    });
  }

  async sendMilestoneStatusEmail(
    to: string,
    name: string,
    caseNumber: string,
    milestoneTitle: string,
    statusMessage: string,
  ): Promise<void> {
    const loginLink = `${this.frontendUrl}/login`;
    await this.send({
      to,
      subject: `Milestone Update – Case ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 16px;color:#374151;">
          Milestone <strong>${milestoneTitle}</strong> on case <strong>${caseNumber}</strong>:
          ${statusMessage}
        </p>
        ${this.button('View Case', loginLink)}
      `),
    });
  }

  async sendCloseConfirmationRequestEmail(
    to: string,
    name: string,
    caseNumber: string,
  ): Promise<void> {
    const loginLink = `${this.frontendUrl}/login`;
    await this.send({
      to,
      subject: `Please Confirm Case Completion – ${caseNumber} – MyBharatConnects`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 16px;color:#374151;">
          Your case <strong>${caseNumber}</strong> has been completed and reviewed by your case
          manager. Please sign in to confirm everything looks good so we can close it out.
        </p>
        ${this.button('Review & Confirm', loginLink)}
      `),
    });
  }

  async sendRentReminderEmail(
    to: string,
    name: string,
    amount: number,
    dueDate: Date,
  ): Promise<void> {
    const formattedAmount = (amount / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
    });
    const formattedDate = dueDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    await this.send({
      to,
      subject: 'Rent Payment Reminder – MyBharatConnects',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          This is a friendly reminder that your rent payment is coming up soon.
          Please ensure timely payment to avoid any late fees.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#fdf8ee;border:1px solid #e8c97a;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#b45309;font-size:13px;">Amount Due</td>
            <td style="color:#d97706;font-weight:700;font-size:20px;text-align:right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Due Date</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${formattedDate}</td>
          </tr>
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          If you have already made this payment, please disregard this message. For any queries,
          contact us at <a href="mailto:info@mybharatconnects.com" style="color:#d97706;text-decoration:none;">info@mybharatconnects.com</a>.
        </p>
      `),
    });
  }

  async sendMeetingLinkEmail(
    to: string,
    name: string,
    meetingLink: string,
    actionTaken?: string,
  ): Promise<void> {
    const actionText =
      actionTaken?.trim() ||
      'A discovery meeting has been scheduled for your request.';
    await this.send({
      to,
      subject: 'Your Meeting Link – MyBharatConnects',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">${actionText}</p>
        ${this.button('Join Meeting', meetingLink)}
        <p style="margin:16px 0 4px;color:#6b7280;font-size:13px;">
          If the button does not work, copy and paste this link into your browser:
        </p>
        <p style="margin:0;word-break:break-all;">
          <a href="${meetingLink}" style="color:#d97706;font-size:12px;">${meetingLink}</a>
        </p>
      `),
    });
  }

  async sendLeadAcknowledgementEmail(
    to: string,
    name: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'We received your query — MyBharatConnects',
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          Thanks for reaching out to MyBharatConnects. A member of our team will review your
          request and get in touch shortly to discuss next steps.
        </p>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          In the meantime, feel free to reply to this email with any additional details about
          what you need.
        </p>
      `),
    });
  }

  async sendLeadAssignedClientEmail(
    to: string,
    name: string,
    caseManagerName: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `Meet your MyBharatConnects Case Manager — ${caseManagerName}`,
      html: this.wrap(`
        ${this.greeting(name)}
        <p style="margin:0 0 20px;color:#374151;">
          <strong>${caseManagerName}</strong> has been assigned as your dedicated case manager
          and will be reaching out to you soon to discuss your requirements in detail.
        </p>
      `),
    });
  }

  async sendLeadAssignedCmEmail(
    to: string,
    cmName: string,
    leadName: string,
    serviceType?: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: `New lead assigned to you — ${leadName}`,
      html: this.wrap(`
        ${this.greeting(cmName)}
        <p style="margin:0 0 20px;color:#374151;">
          A new lead has been assigned to you.
        </p>
        <table cellpadding="0" cellspacing="0" role="presentation"
               style="background:#faf6ed;border:1px solid #ddd5c5;border-radius:6px;padding:16px 20px;margin:0 0 24px;width:100%;">
          <tr>
            <td style="color:#6b7280;font-size:13px;">Name</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;">${leadName}</td>
          </tr>
          ${
            serviceType
              ? `<tr>
            <td style="color:#6b7280;font-size:13px;padding-top:8px;">Service</td>
            <td style="color:#0f1a2e;font-weight:600;font-size:13px;text-align:right;padding-top:8px;">${serviceType}</td>
          </tr>`
              : ''
          }
        </table>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Log in to your dashboard to view full details and reach out.
        </p>
      `),
    });
  }

}
