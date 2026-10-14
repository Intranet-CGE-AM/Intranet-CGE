import { isIP } from "node:net";
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
  // Sem valor explícito, segue o NODE_ENV: produção exige HTTPS, o resto não.
  // Homologação declara `false` porque é acessada por IP e porta, sem TLS —
  // com o cookie marcado Secure o navegador não o devolveria e o login nunca
  // completaria.
  SECURE_COOKIES: z.stringbool().optional(),
  OBJECT_STORAGE_ENDPOINT: z.url().default("http://localhost:9000"),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(3).default("cge-local-minio"),
  OBJECT_STORAGE_SECRET_KEY: z
    .string()
    .min(8)
    .default("cge-local-minio-password"),
  OBJECT_STORAGE_BUCKET: z.string().min(3).max(63).default("intranet-cge"),
});

const resolvedConfigSchema = configSchema.transform((config) => ({
  ...config,
  SECURE_COOKIES: config.SECURE_COOKIES ?? config.NODE_ENV === "production",
}));

const directoryConfigSchema = z.object({
  AD_URL: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "ldaps:" &&
      !isIP(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!url.pathname || url.pathname === "/")
    );
  }, "Use um FQDN com ldaps:// e sem credenciais na URL."),
  AD_DOMAIN: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9.-]+$/),
  AD_NETBIOS: z.string().min(1).optional(),
  AD_BASE_DN: z.string().min(1),
  AD_BIND_DN: z.string().min(1),
  AD_BIND_PASSWORD_FILE: z.string().min(1),
  AD_CA_CERT_FILE: z.string().min(1),
  AD_ALLOWED_GROUP_DN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  AD_RECHECK_SECONDS: z.coerce.number().int().min(1).max(300).default(300),
});
export type DirectoryConfig = z.infer<typeof directoryConfigSchema>;
export type AppConfig = z.infer<typeof resolvedConfigSchema> & {
  directory?: DirectoryConfig;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const enabled = z.stringbool().parse(environment.AD_ENABLED ?? "false");
  return {
    ...resolvedConfigSchema.parse(environment),
    ...(enabled ? { directory: directoryConfigSchema.parse(environment) } : {}),
  };
}
