import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private config: ConfigService) {
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = config.get<string>('AWS_REGION');
    const bucket = config.get<string>('AWS_S3_BUCKET');

    if (region && bucket) {
      // Static keys are only used when explicitly set (local dev against a
      // real bucket with a personal IAM user). In production, no keys are
      // set — omitting `credentials` lets the AWS SDK's default provider
      // chain pick up the ECS task role automatically, instead of the
      // broad, long-lived AmazonS3FullAccess key this used to require.
      this.client = new S3Client({
        region,
        ...(accessKeyId && secretAccessKey
          ? { credentials: { accessKeyId, secretAccessKey } }
          : {}),
      });
      this.bucket = bucket;
    } else {
      this.client = null;
      this.bucket = '';
      this.logger.warn(
        'AWS_REGION/AWS_S3_BUCKET not set — documents/S3 integration disabled',
      );
    }
  }

  private require(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'S3 integration is not configured',
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  // Signing ContentLength makes S3 itself reject any PUT whose actual body
  // size doesn't exactly match the caller-declared size — so a client can't
  // just ignore the app-level size cap and upload more via this URL. Callers
  // must validate the declared size against the cap before calling this.
  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    contentLength: number,
    expiresIn = 300,
  ): Promise<string> {
    const { client, bucket } = this.require();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: contentLength,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const { client, bucket } = this.require();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    const { client, bucket } = this.require();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await client.send(command);
  }

  getBucket(): string {
    return this.bucket;
  }
}
