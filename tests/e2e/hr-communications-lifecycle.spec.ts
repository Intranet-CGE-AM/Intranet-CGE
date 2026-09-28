import { clientHeaders, expect, test } from "./fixtures";
import { createDatabase } from "../../apps/api/src/db/client.js";

test("edição confirma mudança de público, invalida ciência antiga e respeita agendamento e arquivamento", async ({
  playwright,
}) => {
  const { client } = createDatabase(
    "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
  );
  const clients = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, contractor] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "dandara.ribeiro@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const input = {
      title: "Orientações gerais da intranet",
      summary: "Orientações vigentes para a equipe.",
      body: "Leia as orientações.",
      publicationAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2040-12-31T23:59:59.000Z",
      audience: { type: "all" },
      requiresAcknowledgment: true,
    };
    const created = await admin.post("/api/hr-communications", { data: input });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const url = `/api/hr-communications/${id}`;
    const edited = await admin.put(url, {
      data: {
        ...input,
        title: "Orientações revisadas da intranet",
        version: 1,
      },
    });
    expect(edited.status()).toBe(200);
    expect(
      (await admin.post(`${url}/publish`, { data: { version: 2 } })).status(),
    ).toBe(200);
    expect((await contractor.get(url)).status()).toBe(200);
    expect(
      (
        await worker.post(`${url}/acknowledgment`, { data: { version: 3 } })
      ).status(),
    ).toBe(200);
    const targeted = {
      ...input,
      audience: { type: "categories", ids: [users[1].employment.category.id] },
      version: 3,
    };
    expect((await admin.put(url, { data: targeted })).status()).toBe(409);
    expect(
      (
        await admin.put(url, {
          data: { ...targeted, confirmAudienceChange: true },
        })
      ).status(),
    ).toBe(200);
    expect((await contractor.get(url)).status()).toBe(404);
    expect(await (await worker.get(url)).json()).toMatchObject({
      version: 4,
      acknowledgedAt: null,
    });
    expect(
      (
        await worker.post(`${url}/acknowledgment`, { data: { version: 3 } })
      ).status(),
    ).toBe(409);
    expect(
      (
        await worker.post(`${url}/acknowledgment`, { data: { version: 4 } })
      ).status(),
    ).toBe(200);
    const concurrent = await Promise.all(
      ["Primeira edição", "Segunda edição"].map((title) =>
        admin.put(url, { data: { ...targeted, title, version: 4 } }),
      ),
    );
    expect(concurrent.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (await worker.put(url, { data: { ...targeted, version: 5 } })).status(),
    ).toBe(403);
    expect(
      (await admin.post(`${url}/archive`, { data: { version: 5 } })).status(),
    ).toBe(200);
    expect((await worker.get(url)).status()).toBe(404);
    expect(
      (
        await worker.post(`${url}/acknowledgment`, { data: { version: 6 } })
      ).status(),
    ).toBe(404);
    expect(
      (await admin.put(url, { data: { ...targeted, version: 6 } })).status(),
    ).toBe(409);
    expect(await (await admin.get(`${url}?manage=true`)).json()).toMatchObject({
      status: "archived",
      version: 6,
    });
    const future = await admin.post("/api/hr-communications", {
      data: { ...input, publicationAt: "2040-01-01T00:00:00.000Z" },
    });
    expect(future.status()).toBe(201);
    const scheduledUrl = `/api/hr-communications/${(await future.json()).id}`;
    expect(
      await (
        await admin.post(`${scheduledUrl}/publish`, { data: { version: 1 } })
      ).json(),
    ).toMatchObject({ status: "scheduled" });
    expect((await worker.get(scheduledUrl)).status()).toBe(404);
    // Fixture temporal externa: o comportamento continua observado exclusivamente por HTTP.
    await client`update hr_communications set publication_at = '2020-01-01T00:00:00Z' where id = ${scheduledUrl.split("/").at(-1)!}`;
    expect(await (await worker.get(scheduledUrl)).json()).toMatchObject({
      status: "published",
    });
    await client`update hr_communications set expires_at = '2021-01-01T00:00:00Z' where id = ${scheduledUrl.split("/").at(-1)!}`;
    expect((await worker.get(scheduledUrl)).status()).toBe(404);
    expect(
      await (await admin.get(`${scheduledUrl}?manage=true`)).json(),
    ).toMatchObject({ status: "archived" });
    for (const data of [
      { ...input, expiresAt: input.publicationAt },
      {
        ...input,
        audience: {
          type: "units",
          ids: ["00000000-0000-4000-8000-000000000001"],
        },
      },
      { ...input, authorAccountId: users[1].account.id },
    ]) {
      expect(
        (await admin.post("/api/hr-communications", { data })).status(),
      ).toBe(400);
    }
    const events = (
      await (
        await admin.get("/api/audit-events?objectType=hr-communication")
      ).json()
    ).events.filter((event: { objectId: string }) => event.objectId === id);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "hr-communication.updated",
          metadata: expect.objectContaining({
            audienceChanged: true,
            confirmedAudienceChange: true,
          }),
        }),
        expect.objectContaining({ action: "hr-communication.archived" }),
      ]),
    );
  } finally {
    await Promise.all([
      ...clients.map((context) => context.dispose()),
      client.end(),
    ]);
  }
});
