import type { APIRequestContext } from "@playwright/test";

import {
  dedicatedUnit,
  freshAccount,
  overrides,
  signInAll,
} from "./audit-document-api";
import { expect, test } from "./fixtures";

// The setting is global: every test reads the current value first and puts
// that same value back in `finally`.
async function current(client: APIRequestContext) {
  const response = await client.get("/api/audit-documents/settings");
  expect(response.status()).toBe(200);
  return (await response.json()).bottleneckRounds as number;
}
const put = (client: APIRequestContext, bottleneckRounds: unknown) =>
  client.put("/api/audit-documents/settings", { data: { bottleneckRounds } });

test("gargalo aceita de 1 a 20 e recusa o resto sem alterar o valor", async ({
  playwright,
  baseURL,
}) => {
  const [reviewer] = (await signInAll(playwright, baseURL!, "reviewer")) as [
    APIRequestContext,
  ];
  const previous = await current(reviewer);
  try {
    for (const value of [0, 21, 2.5, "3", null])
      expect((await put(reviewer, value)).status()).toBe(400);
    expect(
      (
        await reviewer.put("/api/audit-documents/settings", {
          data: { bottleneckRounds: previous, extra: true },
        })
      ).status(),
    ).toBe(400);
    expect(await current(reviewer)).toBe(previous);
    for (const value of [1, 20]) {
      const response = await put(reviewer, value);
      expect(response.status()).toBe(200);
      expect(await current(reviewer)).toBe(value);
    }
  } finally {
    expect((await put(reviewer, previous)).status()).toBe(200);
    await reviewer.dispose();
  }
});

test("administração global de acessos altera o gargalo sem chave do módulo", async ({
  playwright,
  baseURL,
}) => {
  const [admin, reviewer] = (await signInAll(
    playwright,
    baseURL!,
    "admin",
    "reviewer",
  )) as [APIRequestContext, APIRequestContext];
  const grants = overrides(admin);
  const previous = await current(reviewer);
  let manager: APIRequestContext | undefined;
  try {
    const unit = await dedicatedUnit(admin, "Equipe de configuração E2E");
    const account = await freshAccount(playwright, baseURL!, admin, unit.id);
    manager = account.client;
    expect((await put(manager, 7)).status()).toBe(403);
    await grants.add(account.id, "access.manage", null);
    const changed = await put(manager, previous === 7 ? 8 : 7);
    expect(changed.status()).toBe(200);
    expect(await current(reviewer)).toBe(previous === 7 ? 8 : 7);
    // Revisão só numa unidade não basta (ST-07 com ajuste individual).
    const scoped = await freshAccount(playwright, baseURL!, admin, unit.id);
    try {
      await grants.add(scoped.id, "audit_documents.review", unit.id);
      expect((await put(scoped.client, 5)).status()).toBe(403);
    } finally {
      await scoped.client.dispose();
    }
  } finally {
    expect((await put(reviewer, previous)).status()).toBe(200);
    await grants.revoke();
    await manager?.dispose();
    await Promise.all([admin.dispose(), reviewer.dispose()]);
  }
});
