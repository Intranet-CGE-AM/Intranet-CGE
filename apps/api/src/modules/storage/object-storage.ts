import { Client, S3Error } from "minio";
import type { Readable } from "node:stream";

export type StoredObject = {
  body: Readable;
  contentType: string;
  etag: string;
  size: number;
};

export interface ObjectStorage {
  delete(key: string): Promise<void>;
  ensureReady(): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
}

export class MinioObjectStorage implements ObjectStorage {
  private readonly client: Client;

  constructor(
    private readonly bucket: string,
    endpoint: string,
    accessKey: string,
    secretKey: string,
  ) {
    const url = new URL(endpoint);
    this.client = new Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
      useSSL: url.protocol === "https:",
      accessKey,
      secretKey,
    });
  }

  async ensureReady() {
    if (!(await this.client.bucketExists(this.bucket))) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.putObject(this.bucket, key, body, body.length, {
      "Content-Type": contentType,
    });
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const [body, stat] = await Promise.all([
        this.client.getObject(this.bucket, key),
        this.client.statObject(this.bucket, key),
      ]);
      return {
        body,
        contentType: String(
          stat.metaData["content-type"] ?? "application/octet-stream",
        ),
        etag: stat.etag,
        size: stat.size,
      };
    } catch (error) {
      if (
        error instanceof S3Error &&
        ["NoSuchKey", "NotFound", "NoSuchObject"].includes(error.code ?? "")
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string) {
    await this.client.removeObject(this.bucket, key);
  }
}
