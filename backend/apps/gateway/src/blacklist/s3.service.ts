import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Загрузка фото чёрного списка в MinIO (S3).
 * gateway кладёт фото и возвращает ключ; эмбеддинги считает ai-detection.
 */
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  private readonly bucket = process.env.S3_BUCKET ?? 'event-clips';
  private bucketReady = false;

  constructor() {
    const credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin123',
    };
    const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
    this.client = new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials,
    });
    // Для presigned-ссылок нужен адрес, доступный клиенту (не внутренний minio:9000).
    this.presignClient = new S3Client({
      endpoint: process.env.S3_PUBLIC_ENDPOINT ?? endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials,
    });
  }

  async uploadPhoto(
    storeId: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.ensureBucket();
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const key = `blacklist/${storeId}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  /** Временная ссылка на объект (для показа снимков/клипов в приложении). */
  presign(key: string, expiresSeconds = 3600): Promise<string> {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresSeconds },
    );
  }

  private async ensureBucket() {
    if (this.bucketReady) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketReady = true;
  }
}
