import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class GoogleExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  /**
   * The frontend's redirect_uri (e.g. http://localhost:4200/auth/google/callback).
   * This MUST match the redirect_uri that was passed to Google's auth endpoint
   * — Google's token endpoint rejects exchanges where they differ. We accept
   * it from the frontend so the same value is used end-to-end without needing
   * to keep two env vars (FE + BE) in lockstep.
   */
  @IsString()
  @IsUrl({ require_tld: false })
  redirectUri: string;
}
