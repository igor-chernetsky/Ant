import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface PresignedDownload {
  downloadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly uploadTtlSeconds: number;
  private readonly downloadTtlSeconds: number;
  private readonly internalClient: S3Client | null;
  private readonly publicClient: S3Client | null;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('S3_BUCKET', '');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY', '');
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE', 'false') === 'true';

    const credentials =
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined;

    const internalEndpoint =
      this.config.get<string>('S3_ENDPOINT')?.trim() || undefined;
    const publicEndpoint =
      this.config.get<string>('S3_PUBLIC_ENDPOINT')?.trim() ||
      internalEndpoint;

    this.uploadTtlSeconds = Number(
      this.config.get<string>('S3_UPLOAD_URL_TTL_SECONDS', '900'),
    );
    this.downloadTtlSeconds = Number(
      this.config.get<string>('S3_DOWNLOAD_URL_TTL_SECONDS', '300'),
    );

    if (!this.bucket || !credentials) {
      this.internalClient = null;
      this.publicClient = null;
      return;
    }

    const clientConfig = {
      region,
      credentials,
      forcePathStyle,
      // Browser PUT cannot send SDK checksum headers; default breaks presigned uploads.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    };

    this.internalClient = new S3Client({
      ...clientConfig,
      ...(internalEndpoint ? { endpoint: internalEndpoint } : {}),
    });

    this.publicClient = new S3Client({
      ...clientConfig,
      ...(publicEndpoint ? { endpoint: publicEndpoint } : {}),
    });
  }

  isConfigured(): boolean {
    return this.internalClient !== null && this.publicClient !== null;
  }

  private requireClient(): { internal: S3Client; pub: S3Client; bucket: string } {
    if (!this.internalClient || !this.publicClient || !this.bucket) {
      throw new ServiceUnavailableException(
        'File storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.',
      );
    }
    return {
      internal: this.internalClient,
      pub: this.publicClient,
      bucket: this.bucket,
    };
  }

  async createPresignedUpload(input: {
    storageKey: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignedUpload> {
    const { pub, bucket } = this.requireClient();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.storageKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(pub, command, {
      expiresIn: this.uploadTtlSeconds,
    });

    return {
      uploadUrl,
      storageKey: input.storageKey,
      expiresInSeconds: this.uploadTtlSeconds,
    };
  }

  async createPresignedDownload(storageKey: string): Promise<PresignedDownload> {
    const { pub, bucket } = this.requireClient();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    const downloadUrl = await getSignedUrl(pub, command, {
      expiresIn: this.downloadTtlSeconds,
    });

    return {
      downloadUrl,
      expiresInSeconds: this.downloadTtlSeconds,
    };
  }

  async verifyObject(storageKey: string): Promise<{ sizeBytes: number }> {
    const { internal, bucket } = this.requireClient();

    const head = await internal.send(
      new HeadObjectCommand({ Bucket: bucket, Key: storageKey }),
    );

    return { sizeBytes: head.ContentLength ?? 0 };
  }

  async deleteObject(storageKey: string): Promise<void> {
    const { internal, bucket } = this.requireClient();
    await internal.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }),
    );
  }

  async getObjectBuffer(storageKey: string): Promise<Buffer> {
    const { internal, bucket } = this.requireClient();
    const response = await internal.send(
      new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
    );

    if (!response.Body) {
      throw new Error('Empty object body');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(input: {
    storageKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    const { internal, bucket } = this.requireClient();
    await internal.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.storageKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }
}
