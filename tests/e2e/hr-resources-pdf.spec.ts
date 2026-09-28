import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture";

test("PDF da biblioteca aceita até 10 MB, é privado e exige público atual no download", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2, 3].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, outside, anonymous] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "leonardo.araujo@homolog.cge.am.gov.br",
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
    const metadata = {
      type: "manual",
      title: "Manual institucional em PDF",
      summary: "Orientações para uso interno da unidade.",
      category: "Manuais",
      responsibleName: "Gestão de Pessoas",
      validFrom: "2026-01-01",
      validUntil: "2040-12-31",
      audience: { type: "units", ids: [users[1].employment.unit.id] },
      requiresAcknowledgment: false,
      externalUrl: null,
    };
    const largePdf = Buffer.concat([
      blankPdf,
      Buffer.alloc(6 * 1024 * 1024, 0x20),
      Buffer.from("\n%%EOF\n"),
    ]);
    const created = await admin.post("/api/hr-resources", {
      multipart: {
        metadata: JSON.stringify(metadata),
        file: {
          name: "manual.pdf",
          mimeType: "application/pdf",
          buffer: largePdf,
        },
      },
    });
    expect(created.status()).toBe(201);
    const item = await created.json();
    expect(item).toMatchObject({
      type: "manual",
      fileSize: largePdf.length,
      externalUrl: null,
    });
    expect(item).not.toHaveProperty("objectKey");
    const fileUrl = `/api/hr-resources/${item.id}/file`;
    const downloaded = await worker.get(fileUrl);
    expect(downloaded.status()).toBe(200);
    expect(downloaded.headers()["content-type"]).toBe("application/pdf");
    expect(downloaded.headers()["cache-control"]).toBe("no-store");
    expect(downloaded.headers()["content-disposition"]).toContain("attachment");
    expect((await downloaded.body()).equals(largePdf)).toBe(true);
    expect((await outside.get(fileUrl)).status()).toBe(404);
    expect((await anonymous.get(fileUrl)).status()).toBe(401);
    expect((await admin.get(`${fileUrl}?manage=true`)).status()).toBe(200);
    const audit = await (
      await admin.get("/api/audit-events?action=hr-resource.admin-downloaded")
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: item.id,
          actor: expect.objectContaining({ accountId: users[0].account.id }),
        }),
      ]),
    );
    for (const file of [
      {
        name: "falso.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nNão é um documento válido\n%%EOF"),
      },
      { name: "manual.txt", mimeType: "text/plain", buffer: blankPdf },
      {
        name: "excedido.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      },
    ])
      expect(
        (
          await admin.post("/api/hr-resources", {
            multipart: { metadata: JSON.stringify(metadata), file },
          })
        ).status(),
      ).toBe(400);
    expect(
      (await admin.post("/api/hr-resources", { data: metadata })).status(),
    ).toBe(400);
    expect(
      (
        await admin.post("/api/hr-resources", {
          multipart: {
            metadata: JSON.stringify({
              ...metadata,
              externalUrl: "https://www.cge.am.gov.br/",
            }),
            file: {
              name: "ambíguo.pdf",
              mimeType: "application/pdf",
              buffer: blankPdf,
            },
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post("/api/hr-resources", {
          multipart: {
            metadata: JSON.stringify({ ...metadata, type: "external_link" }),
            file: {
              name: "manual.pdf",
              mimeType: "application/pdf",
              buffer: blankPdf,
            },
          },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await Promise.all(clients.map((context) => context.dispose()));
  }
});
