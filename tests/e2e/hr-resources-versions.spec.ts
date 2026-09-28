import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture";

test("nova versão preserva PDF anterior, exige nova ciência e impede publicação concorrente ou retorno após arquivar", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker] = clients;
  try {
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
    ].entries())
      expect(
        (
          await clients[index].post("/api/auth/login", {
            data: {
              email,
              password: index
                ? "Homolog-Password-2026"
                : "Admin-E2E-Password-123",
            },
          })
        ).status(),
      ).toBe(200);
    const input = {
      type: "policy",
      title: "Política institucional original",
      summary: "Orientações da versão original para uso interno.",
      category: "Políticas",
      responsibleName: "Gestão de Pessoas",
      validFrom: "2026-01-01",
      validUntil: "2040-12-31",
      audience: { type: "all" },
      requiresAcknowledgment: true,
      externalUrl: null,
    };
    const created = await admin.post("/api/hr-resources", {
      multipart: {
        metadata: JSON.stringify(input),
        file: {
          name: "politica.pdf",
          mimeType: "application/pdf",
          buffer: blankPdf,
        },
      },
    });
    expect(created.status()).toBe(201);
    const first = await created.json();
    const updatedInput = {
      ...input,
      title: "Política institucional revisada",
      externalUrl: "https://www.cge.am.gov.br/",
      version: 1,
    };
    const secondResponse = await admin.post(
      `/api/hr-resources/${first.id}/versions`,
      { data: updatedInput },
    );
    expect(secondResponse.status()).toBe(201);
    const second = await secondResponse.json();
    expect(second).toMatchObject({
      version: 2,
      rootId: first.id,
      acknowledgedAt: null,
    });
    expect(second.id).not.toBe(first.id);
    expect(
      await (
        await admin.get(`/api/hr-resources/${first.id}?manage=true`)
      ).json(),
    ).toMatchObject({
      title: input.title,
      version: 1,
      status: "superseded",
      externalUrl: null,
      supersededById: second.id,
    });
    expect((await worker.get(`/api/hr-resources/${first.id}`)).status()).toBe(
      404,
    );
    expect(
      (await worker.get(`/api/hr-resources/${first.id}/file`)).status(),
    ).toBe(404);
    const historicalPdf = await admin.get(
      `/api/hr-resources/${first.id}/file?manage=true`,
    );
    expect(historicalPdf.status()).toBe(200);
    expect((await historicalPdf.body()).equals(blankPdf)).toBe(true);
    const ackUrl = `/api/hr-resources/${second.id}/acknowledgment`;
    const ack = await worker.post(ackUrl, { data: { version: 2 } });
    expect(ack.status()).toBe(200);
    const acknowledgment = await ack.json();
    expect(acknowledgment.acknowledgedAt).toBeTruthy();
    expect(
      await (await worker.post(ackUrl, { data: { version: 2 } })).json(),
    ).toEqual(acknowledgment);
    expect(
      await (await worker.get(`/api/hr-resources/${second.id}`)).json(),
    ).toMatchObject(acknowledgment);
    const revisions = await Promise.all(
      ["Política revisada A", "Política revisada B"].map((title) =>
        admin.post(`/api/hr-resources/${second.id}/versions`, {
          data: { ...updatedInput, title, version: 2 },
        }),
      ),
    );
    expect(revisions.map((response) => response.status()).sort()).toEqual([
      201, 409,
    ]);
    const third = await revisions
      .find((response) => response.status() === 201)!
      .json();
    expect(
      await (await worker.get(`/api/hr-resources/${third.id}`)).json(),
    ).toMatchObject({ version: 3, acknowledgedAt: null });
    expect((await worker.post(ackUrl, { data: { version: 2 } })).status()).toBe(
      404,
    );
    expect(
      (
        await worker.post(`/api/hr-resources/${third.id}/versions`, {
          data: { ...updatedInput, version: 3 },
        })
      ).status(),
    ).toBe(403);
    const history = await admin.get(`/api/hr-resources/${third.id}/versions`);
    expect(history.status()).toBe(200);
    expect(
      (await history.json()).resources.map(
        (item: { version: number }) => item.version,
      ),
    ).toEqual([3, 2, 1]);
    expect(
      (await worker.get(`/api/hr-resources/${third.id}/versions`)).status(),
    ).toBe(403);
    expect(
      (
        await admin.post(`/api/hr-resources/${third.id}/archive`, {
          data: { version: 3 },
        })
      ).status(),
    ).toBe(200);
    expect((await worker.get(`/api/hr-resources/${third.id}`)).status()).toBe(
      404,
    );
    const listed = (
      await (await worker.get("/api/hr-resources?query=Política")).json()
    ).resources;
    expect(listed.map((item: { rootId: string }) => item.rootId)).not.toContain(
      first.id,
    );
    expect(
      (
        await admin.post(`/api/hr-resources/${third.id}/versions`, {
          data: { ...updatedInput, version: 3 },
        })
      ).status(),
    ).toBe(409);
    const events = (
      await (
        await admin.get("/api/audit-events?objectType=hr-resource&pageSize=100")
      ).json()
    ).events;
    expect(
      events.filter(
        (event: { action: string; objectId: string }) =>
          event.action === "hr-resource.acknowledged" &&
          event.objectId === second.id,
      ),
    ).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "hr-resource.archived",
          objectId: third.id,
        }),
      ]),
    );
  } finally {
    await Promise.all(clients.map((context) => context.dispose()));
  }
});
