import { randomUUID } from "node:crypto";

import { auditAccounts, signIn } from "./audit-document-fixtures";
import {
  clientHeaders,
  expect,
  type APIRequestContext,
  type PlaywrightWorkerArgs,
} from "./fixtures";

// Shared helpers for the audit document API specs. Every spec creates its own
// documents, units and accounts, and cleans grants in `finally`.

export type AuditDetail = {
  id: string;
  unitId: string;
  status: string;
  version: number;
  fileCount: number;
  correctionRounds: number;
  allowedActions: string[];
  files: {
    id: string;
    number: number;
    fileName: string;
    kind: string;
    size: number;
    sha256: string;
    source: string;
    uploadedAs: string;
    uploadedByAccountId: string;
  }[];
  events: {
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    message: string | null;
    actorAccountId: string;
    fileId: string | null;
    delegation: { id: string; originalAccountId: string } | null;
  }[];
};

export const e2eDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e";
export const e2eObjectStorageUrl =
  process.env.E2E_OBJECT_STORAGE_URL ?? "http://127.0.0.1:9000";

export const unique = (label: string) => `${label} ${randomUUID().slice(0, 8)}`;

export async function detail(client: APIRequestContext, id: string) {
  const response = await client.get(`/api/audit-documents/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()) as AuditDetail;
}

export function transition(
  client: APIRequestContext,
  id: string,
  data: Record<string, unknown>,
) {
  return client.post(`/api/audit-documents/${id}/transition`, { data });
}

export async function accountId(client: APIRequestContext) {
  const response = await client.get("/api/auth/me");
  expect(response.status()).toBe(200);
  return (await response.json()).user.account.id as string;
}

/** Audit rows of one document, filtered by the server (not by the page). */
export async function auditRows(
  admin: APIRequestContext,
  objectId: string,
  filters: Record<string, string> = {},
) {
  const query = new URLSearchParams({ objectId, pageSize: "100", ...filters });
  const response = await admin.get(`/api/audit-events?${query}`);
  expect(response.status()).toBe(200);
  const { events, pagination } = (await response.json()) as {
    events: {
      action: string;
      outcome: string;
      objectId: string | null;
      actor: { accountId: string } | null;
      metadata: Record<string, unknown>;
    }[];
    pagination: { total: number };
  };
  expect(events.length).toBe(pagination.total);
  for (const event of events) expect(event.objectId).toBe(objectId);
  return events;
}

export async function dedicatedUnit(
  admin: APIRequestContext,
  name: string,
  parentId?: string,
) {
  const response = await admin.post("/api/organization-units", {
    data: {
      code: `AUD-${randomUUID().slice(0, 12)}`,
      name: unique(name),
      ...(parentId ? { parentId } : {}),
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; name: string };
}

/** Permission overrides created by a spec; `revoke` goes in `finally`. */
export function overrides(admin: APIRequestContext) {
  const ids: string[] = [];
  return {
    async add(
      accountId: string,
      permission: string,
      unitId: string | null,
      effect: "allow" | "deny" = "allow",
    ) {
      const response = await admin.post("/api/admin/permission-overrides", {
        data: { accountId, permission, effect, unitId },
      });
      expect(response.status()).toBe(201);
      const { id } = (await response.json()) as { id: string };
      ids.push(id);
      return id;
    },
    async revoke() {
      for (const id of ids.splice(0))
        await admin.delete(`/api/admin/permission-overrides/${id}`);
    },
  };
}

/**
 * A new person and account without any audit permission, already past the
 * forced password change. Returns a signed-in client.
 */
export async function freshAccount(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  admin: APIRequestContext,
  unitId: string,
) {
  const categories = (await (
    await admin.get("/api/employment-categories")
  ).json()) as { categories: { id: string }[] };
  const person = await admin.post("/api/people", {
    data: {
      fullName: unique("Pessoa de teste de auditoria"),
      employment: {
        employeeNumber: `AUD-${randomUUID().slice(0, 12)}`,
        unitId,
        categoryId: categories.categories[0]!.id,
        startDate: "2020-01-01",
      },
    },
  });
  expect(person.status()).toBe(201);
  const email = `auditoria-${randomUUID()}@local.invalid`;
  const temporaryPassword = "Temporaria-E2E-Password-1";
  const password = "Auditoria-E2E-Password-2";
  const user = await admin.post("/api/admin/users", {
    data: {
      personId: (await person.json()).personId,
      email,
      temporaryPassword,
    },
  });
  expect(user.status()).toBe(201);
  const client = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { ...clientHeaders(), Origin: baseURL },
  });
  const login = (value: string) =>
    client.post("/api/auth/login", { data: { email, password: value } });
  expect((await login(temporaryPassword)).status()).toBe(200);
  expect(
    (
      await client.post("/api/auth/password", {
        data: { currentPassword: temporaryPassword, newPassword: password },
      })
    ).status(),
  ).toBe(200);
  expect((await login(password)).status()).toBe(200);
  return { client, id: (await user.json()).id as string };
}

export const signInAll = (
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  ...emails: (keyof typeof auditAccounts)[]
) =>
  Promise.all(
    emails.map((email) => signIn(playwright, baseURL, auditAccounts[email])),
  );
