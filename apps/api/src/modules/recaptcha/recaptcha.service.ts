import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

// Guards the public, unauthenticated endpoints (lead capture, registration)
// against bot spam. Same graceful-stub pattern as this repo's other optional
// integrations: unset RECAPTCHA_SECRET_KEY means "not configured for this
// environment" (local dev, most CI) — skip verification rather than block
// every lead/signup, matching how e.g. EMAIL_ENABLED=false no-ops instead
// of hard-failing.
@Injectable()
export class RecaptchaService {
  private readonly secretKey?: string;
  private readonly minScore: number;
  private readonly logger = new Logger(RecaptchaService.name);
  private warnedUnconfigured = false;

  constructor(private readonly config: ConfigService) {
    this.secretKey = this.config.get<string>('RECAPTCHA_SECRET_KEY');
    this.minScore = Number(this.config.get<string>('RECAPTCHA_MIN_SCORE', '0.5'));
  }

  /**
   * Verifies a reCAPTCHA v3 token against Google's siteverify endpoint.
   * Throws BadRequestException if the token is missing/invalid, the action
   * doesn't match what this endpoint expects (someone reusing a token
   * minted for a different form), or the bot-likelihood score is too low.
   */
  async verify(token: string | undefined, expectedAction: string): Promise<void> {
    if (!this.secretKey) {
      if (!this.warnedUnconfigured) {
        this.logger.warn(
          'RECAPTCHA_SECRET_KEY not set — skipping reCAPTCHA verification',
        );
        this.warnedUnconfigured = true;
      }
      return;
    }

    if (!token) {
      throw new BadRequestException('reCAPTCHA verification is required');
    }

    const params = new URLSearchParams({ secret: this.secretKey, response: token });
    let res: Response;
    try {
      res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
      const detail = cause
        ? `${cause.code ?? ''} ${cause.message ?? ''}`.trim()
        : (err as Error)?.message;
      this.logger.error(`reCAPTCHA siteverify unreachable: ${detail}`, (err as Error)?.stack);
      throw new BadRequestException('reCAPTCHA verification failed — please try again');
    }

    if (!res.ok) {
      this.logger.warn(`reCAPTCHA siteverify HTTP ${res.status}`);
      throw new BadRequestException('reCAPTCHA verification failed — please try again');
    }

    const data = (await res.json()) as SiteVerifyResponse;
    const scoreOk = typeof data.score !== 'number' || data.score >= this.minScore;
    const actionOk = !data.action || data.action === expectedAction;

    if (!data.success || !scoreOk || !actionOk) {
      this.logger.warn(
        `reCAPTCHA rejected: success=${data.success} score=${data.score} action=${data.action} errors=${(data['error-codes'] ?? []).join(',')}`,
      );
      throw new BadRequestException('reCAPTCHA verification failed — please try again');
    }
  }
}
