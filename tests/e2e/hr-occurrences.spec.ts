import { clientHeaders, expect, test } from "./fixtures";

test("catálogo de ocorrências controla envio, vigência e documento obrigatório", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let grantId: string | undefined;
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).status(),
    ).toBe(200);
    const login = await worker.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    expect(login.status()).toBe(200);
    const { user } = await login.json();
    const input = {
      name: "Ausência administrativa E2E",
      active: true,
      requiresSupervisor: true,
      requiresRH: true,
      requiresDocument: false,
      affectsAvailability: true,
      documentTypeId: null,
    };
    const catalog = await admin.post("/api/occurrence-types", { data: input });
    expect(catalog.status()).toBe(201);
    const type = await catalog.json();
    const payload = {
      typeId: type.id,
      startDate: "2030-04-10",
      endDate: "2030-04-12",
      justification: "Solicitação administrativa para análise",
      submit: true,
    };
    expect(
      (await worker.post("/api/occurrences", { data: payload })).status(),
    ).toBe(403);
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "occurrences.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    expect(
      (
        await worker.post("/api/occurrences", {
          data: { ...payload, endDate: "2030-04-09" },
        })
      ).status(),
    ).toBe(400);
    const created = await worker.post("/api/occurrences", { data: payload });
    expect(created.status()).toBe(201);
    const item = await created.json();
    expect(item).toMatchObject({
      status: "submitted",
      version: 1,
      typeName: input.name,
    });
    expect(
      (await (await worker.get("/api/occurrences?scope=mine")).json())
        .occurrences,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: item.id })]),
    );
    expect(
      (
        await admin.put(`/api/occurrence-types/${type.id}`, {
          data: { ...input, active: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await worker.post("/api/occurrences", { data: payload })).status(),
    ).toBe(400);
    const documentType = await admin.post("/api/document-types", {
      data: {
        name: "Comprovante restrito E2E",
        purpose: "Analisar ocorrência funcional",
        policyReference: "Política interna de homologação",
        retentionDays: 365,
        sensitive: true,
      },
    });
    expect(documentType.status()).toBe(201);
    expect(
      (
        await admin.put(`/api/occurrence-types/${type.id}`, {
          data: {
            ...input,
            requiresDocument: true,
            documentTypeId: (await documentType.json()).id,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await worker.post("/api/occurrences", { data: payload })).status(),
    ).toBe(400);
    expect(
      (
        await worker.post("/api/occurrences", {
          data: { ...payload, submit: false },
        })
      ).status(),
    ).toBe(201);
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await worker.dispose();
    await admin.dispose();
  }
});
