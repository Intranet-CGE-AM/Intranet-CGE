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
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  return configSchema.parse(environment);
}
