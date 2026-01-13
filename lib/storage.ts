import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

if (!process.env.S3_ENDPOINT) {
  throw new Error('S3_ENDPOINT environment variable is not set');
}
if (!process.env.S3_ACCESS_KEY) {
  throw new Error('S3_ACCESS_KEY environment variable is not set');
}
if (!process.env.S3_SECRET_KEY) {
  throw new Error('S3_SECRET_KEY environment variable is not set');
}
if (!process.env.S3_BUCKET) {
  throw new Error('S3_BUCKET environment variable is not set');
}

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET = process.env.S3_BUCKET;

export const storage = {
  // Upload a file
  async upload(
    key: string,
    body: Buffer | Uint8Array | Blob | string,
    contentType?: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return key;
  },

  // Get a file
  async get(key: string): Promise<Uint8Array | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      const response = await s3Client.send(command);
      if (!response.Body) return null;

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error: any) {
      if (error.name === 'NoSuchKey') return null;
      throw error;
    }
  },

  // Delete a file
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await s3Client.send(command);
  },

  // List files with optional prefix
  async list(prefix?: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    return response.Contents?.map((obj) => obj.Key!) || [];
  },

  // Get a presigned URL for uploading (valid for 1 hour by default)
  async getUploadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  // Get a presigned URL for downloading (valid for 1 hour by default)
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  // Check if a file exists
  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  },
};
