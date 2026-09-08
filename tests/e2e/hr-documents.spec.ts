import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";
import { blankPdf } from "./pdf-fixture.js";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15_000 });
test("RH publica documento pela interface sem precisar recarregar tipos", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill("admin-e2e@local.invalid");
  await page.getByLabel("Senha").fill("Admin-E2E-Password-123");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: /Bom dia, Administrador/ }),
  ).toBeVisible();
  await page.goto("/rh/documentos");
  await page
    .getByLabel("Titular", { exact: true })
    .selectOption({ label: "Caio Nascimento Almeida" });
  await page
    .getByText("Cadastrar tipo e política documental", { exact: true })
    .click();
  await page.getByLabel("Nome do tipo").fill("Certidão E2E da interface");
  await page
    .getByLabel("Finalidade", { exact: true })
    .fill("Comprovar vínculo para capacitação");
  await page
    .getByLabel("Referência da política aprovada")
    .fill("Política documental sintética E2E");
  await page.getByLabel("Retenção em dias desde a publicação").fill("180");
  await page
    .getByRole("button", { name: "Cadastrar tipo", exact: true })
    .click();
  await expect(
    page.getByText("Tipo cadastrado.", { exact: true }),
  ).toBeVisible();
  await page.getByText("Publicar documento", { exact: true }).first().click();
  await page
    .getByLabel("Tipo de documento")
    .selectOption({ label: "Certidão E2E da interface" });
  await page
    .getByLabel("Título", { exact: true })
    .fill("Certidão publicada pela interface");
  await page.getByLabel("Data de emissão").fill("2026-09-07");
  await page.getByLabel("Fonte / área responsável").fill("Gestão de Pessoas");
  await page.getByLabel("Arquivo PDF").setInputFiles({
    name: "certidao.pdf",
    mimeType: "application/pdf",
    buffer: blankPdf,
  });
  await page.getByLabel("Solicitar ciência do titular").check();
  await page
    .getByRole("button", { name: "Publicar documento", exact: true })
    .click();
  await expect(
    page.getByText("Documento publicado no dossiê.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Baixar Certidão publicada pela interface",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Arquivo PDF")).toBeHidden();
  await page
    .getByRole("heading", { name: "Documentos privados", exact: true })
    .click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/documents-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Buscar titular").fill("Renata");
  await expect(
    page.getByRole("heading", { name: "Documentos funcionais", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Titular", { exact: true })).toHaveValue("");
  await page.request.post("/api/auth/logout");
  await page.request.post("/api/auth/login", {
    data: {
      email: "caio.nascimento@homolog.cge.am.gov.br",
      password: "Homolog-Password-2026",
    },
  });
  await page.goto("/rh/meu-dossie");
  const documentRow = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: "Certidão publicada pela interface",
      exact: true,
    }),
  });
  const confirm = documentRow.getByRole("button", {
    name: "Confirmar ciência",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/document-ack-${width}.png`,
      fullPage: true,
    });
  }
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(documentRow.getByText(/Ciência confirmada em/)).toBeVisible();
  await page.reload();
  await expect(documentRow.getByText(/Ciência confirmada em/)).toBeVisible();
});
test("RH publica PDF privado e apenas titular ou RH autorizado pode baixar", async ({
  page,
  playwright,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  expect((await page.request.get("/api/me/documents")).status()).toBe(401);
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  const outsider = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  const grants: string[] = [];
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const login = await page.request.post("/api/auth/login", {
      headers,
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    const { user } = await login.json();
    const outsiderLogin = await outsider.post("/api/auth/login", {
      data: {
        email: "helena.monteiro@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    const { user: otherUser } = await outsiderLogin.json();
    const type = await admin.post("/api/document-types", {
      data: {
        name: "Declaração de teste",
        purpose: "Comprovar vínculo funcional",
        retentionDays: 365,
        policyReference: "Política de teste E2E",
        sensitive: false,
      },
    });
    expect(type.status()).toBe(201);
    const { id: typeId } = await type.json();
    const metadata = {
      personId: user.person.id,
      typeId,
      title: "Declaração de vínculo E2E",
      issuedOn: "2026-09-07",
      source: "Gestão de Pessoas",
    };
    const bad = await admin.post("/api/documents", {
      multipart: {
        metadata: JSON.stringify(metadata),
        file: {
          name: "falso.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("isto não é PDF"),
        },
      },
    });
    expect(bad.status()).toBe(400);
    const disguised = await admin.post("/api/documents", {
      multipart: {
        metadata: JSON.stringify(metadata),
        file: {
          name: "falso.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\ntrailer\n<<>>\n%%EOF\n"),
        },
      },
    });
    expect(disguised.status()).toBe(400);
    for (const file of [
      { name: "errado.pdf", mimeType: "text/plain", buffer: blankPdf },
      {
        name: "grande.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
      },
    ]) {
      expect(
        (
          await admin.post("/api/documents", {
            multipart: { metadata: JSON.stringify(metadata), file },
          })
        ).status(),
      ).toBe(400);
    }
    const pdf = blankPdf;
    const upload = await admin.post("/api/documents", {
      multipart: {
        metadata: JSON.stringify(metadata),
        file: {
          name: "declaracao.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
      },
    });
    expect(upload.status()).toBe(201);
    const document = await upload.json();
    expect(document).toMatchObject({
      title: "Declaração de vínculo E2E",
      purpose: "Comprovar vínculo funcional",
      source: "Gestão de Pessoas",
    });
    expect(document).not.toHaveProperty("objectKey");
    expect(
      (await outsider.get(`/api/documents/${document.id}/file`)).status(),
    ).toBe(404);
    const wrongUnit = await admin.post("/api/organization-units", {
      data: { code: `DOC-${Date.now()}`, name: "Unidade documental E2E" },
    });
    expect(wrongUnit.status()).toBe(201);
    const { id: wrongUnitId } = await wrongUnit.json();
    for (const unitId of [wrongUnitId, user.employment.unit.id]) {
      const grant = await admin.post("/api/admin/permission-overrides", {
        data: {
          accountId: otherUser.account.id,
          permission: "documents.read",
          effect: "allow",
          unitId,
        },
      });
      expect(grant.status()).toBe(201);
      grants.push((await grant.json()).id);
      expect(
        (await outsider.get(`/api/documents/${document.id}/file`)).status(),
      ).toBe(unitId === wrongUnitId ? 404 : 200);
    }
    const sensitiveType = await admin.post("/api/document-types", {
      data: {
        name: "Documento restrito E2E",
        purpose: "Finalidade restrita sintética",
        retentionDays: 30,
        policyReference: "Política restrita E2E",
        sensitive: true,
      },
    });
    const sensitiveUpload = await admin.post("/api/documents", {
      multipart: {
        metadata: JSON.stringify({
          ...metadata,
          title: "Documento restrito E2E",
          typeId: (await sensitiveType.json()).id,
        }),
        file: {
          name: "restrito.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
      },
    });
    expect(sensitiveUpload.status()).toBe(201);
    const { id: sensitiveId } = await sensitiveUpload.json();
    expect(
      (await outsider.get(`/api/documents/${sensitiveId}/file`)).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/documents/${sensitiveId}/file`)).status(),
    ).toBe(200);
    const own = await page.request.get(`/api/documents/${document.id}/file`);
    expect(own.status()).toBe(200);
    expect(own.headers()["content-disposition"]).toContain("attachment");
    expect(await own.body()).toEqual(pdf);
    await page.goto("/rh/meu-dossie");
    await expect(
      page.getByRole("heading", { name: "Documentos funcionais" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Baixar Declaração de vínculo E2E" }),
    ).toBeVisible();
    expect(
      (await admin.post(`/api/documents/${document.id}/archive`)).status(),
    ).toBe(204);
    expect(
      (await page.request.get(`/api/documents/${document.id}/file`)).status(),
    ).toBe(404);
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Baixar Declaração de vínculo E2E" }),
    ).toHaveCount(0);
  } finally {
    for (const id of grants)
      await admin.delete(`/api/admin/permission-overrides/${id}`);
    await admin.dispose();
    await outsider.dispose();
  }
});
