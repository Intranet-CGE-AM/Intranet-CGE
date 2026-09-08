import { clientHeaders, expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";

test.use({ actionTimeout: 15000 });
test("falha de anexo mantém o rascunho e permite retomar sem duplicar ocorrência", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({
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
    const login = await page.request.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    expect(login.status()).toBe(200);
    const { user } = await login.json();
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
    const policy = await admin.post("/api/document-types", {
      data: {
        name: "Comprovante recuperável",
        purpose: "Analisar ocorrência recuperável",
        policyReference: "Política de homologação",
        retentionDays: 180,
        sensitive: true,
      },
    });
    expect(policy.status()).toBe(201);
    const type = await admin.post("/api/occurrence-types", {
      data: {
        name: "Ocorrência recuperável",
        active: true,
        requiresSupervisor: true,
        requiresRH: true,
        requiresDocument: true,
        affectsAvailability: true,
        documentTypeId: (await policy.json()).id,
      },
    });
    expect(type.status()).toBe(201);
    await page.goto("/rh/ocorrencias");
    await page
      .getByRole("button", { name: "Nova ocorrência", exact: true })
      .click();
    await page
      .getByLabel("Tipo de ocorrência")
      .selectOption({ label: "Ocorrência recuperável" });
    await page.getByLabel("Data inicial").fill("2035-02-01");
    await page.getByLabel("Data final").fill("2035-02-03");
    await page
      .getByLabel("Justificativa")
      .fill("Solicitação com anexo recuperável após falha.");
    const file = {
      name: "comprovante.pdf",
      mimeType: "application/pdf",
      buffer: blankPdf,
    };
    await page
      .getByLabel("Comprovante PDF", { exact: true })
      .setInputFiles(file);
    await page.route(
      "**/api/documents",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Armazenamento temporariamente indisponível.",
          }),
        }),
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Enviar ocorrência", exact: true })
      .click();
    await expect(
      page.getByText(
        "Rascunho salvo. Abra o acompanhamento para tentar anexar ou enviar novamente.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Anexar comprovante PDF")).toBeVisible();
    await expect(
      page.getByText("Armazenamento temporariamente indisponível.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Anexar comprovante PDF").setInputFiles(file);
    await page
      .getByRole("button", { name: "Anexar comprovante", exact: true })
      .click();
    await expect(
      page.getByText("Comprovante anexado. Você já pode enviar a ocorrência.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Enviar ocorrência", exact: true })
      .click();
    await expect(
      page.getByText("Ocorrência atualizada.", { exact: true }),
    ).toBeVisible();
    const items = (
      await (await page.request.get("/api/occurrences?scope=mine")).json()
    ).occurrences.filter(
      (item: { typeName: string }) =>
        item.typeName === "Ocorrência recuperável",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: "submitted", version: 3 });
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await admin.dispose();
  }
});
