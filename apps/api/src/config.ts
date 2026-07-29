import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://cge:cge@localhost:5432/intranet_cge"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("development-only-session-secret-change-me"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  SECURE_COOKIES: z.stringbool().default(true),
  OBJECT_STORAGE_ENDPOINT: z.url().default("http://localhost:9000"),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(3).default("cge-local-minio"),
  OBJECT_STORAGE_SECRET_KEY: z
    .string()
    .min(8)
    .default("cge-local-minio-password"),
  OBJECT_STORAGE_BUCKET: z.string().min(3).max(63).default("intranet-cge"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(environment);
}
