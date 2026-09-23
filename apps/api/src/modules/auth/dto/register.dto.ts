import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Public sign-up DTO. Deliberately does NOT accept `role` from the body —
 * the public endpoint always creates CLIENT users. Non-client accounts
 * (CASE_MANAGER, VENDOR, QA, OPS_FINANCE, ADMIN) are created by an
 * existing ADMIN via `POST /users`. This closes the privilege-escalation
 * hole where anyone could `curl /auth/register {"role":"ADMIN"}` and
 * become a system admin.
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty()
  @IsString()
  name: string;

  // Required whenever RECAPTCHA_SECRET_KEY is configured (enforced in
  // RecaptchaService.verify(), not here) — optional at the DTO level so
  // environments without a key configured (local dev, most of the e2e
  // suite) aren't forced to send one.
  @ApiProperty({ description: 'reCAPTCHA v3 token from the client', required: false })
  @IsString()
  @IsOptional()
  recaptchaToken?: string;
}
