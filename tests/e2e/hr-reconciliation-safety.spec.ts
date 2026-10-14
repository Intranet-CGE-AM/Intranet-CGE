import { clientHeaders } from "./fixtures";
import { expect, test, type Page } from "./fixtures";

test.use({ actionTimeout: 15_000 });
const headers = { Origin: "http://127.0.0.1:4173" };
async function prepare(page: Page) {
  await page.request.post("/api/auth/login", {
    headers,
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  const number = `RECSAFE-${Date.now()}`;
  const csv = [
    "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
    `${number},Reconciliação Segura,,,nao,Efetivo Reconciliação,RECSAFE,Unidade Reconciliação,Analista importado,2020-01-01,sim`,
  ].join("\n");
  await page.request.post("/api/imports/people", {
    headers,
    data: { filename: "segura.csv", csv, mode: "apply" },
  });
  const {
    people: [person],
  } = await (await page.request.get(`/api/people?query=${number}`)).json();
  const move = (expectedVersion: number, jobTitle: string) =>
    page.request.post(`/api/people/${person.id}/movements`, {
      headers,
      data: {
        expectedVersion,
        effectiveOn: "2026-09-07",
        reason: "Ajuste administrativo conferido",
        changes: { jobTitle },
      },
    });
  expect((await move(1, "Analista manual")).status()).toBe(201);
  await page.goto("/rh/colaboradores");
  await page.getByRole("button", { name: "Importar CSV" }).click();
  await page.getByLabel("Arquivo CSV").setInputFiles({
    name: "segura.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  return { number, move };
}

test("não permite trocar o arquivo enquanto a validação está em andamento", async ({
  page,
}) => {
  await prepare(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/imports/people", async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Validar arquivo" }).click();
    await started;
    await expect(page.getByLabel("Arquivo CSV")).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: "Aplicar 1 linha válida" }),
  ).toBeEnabled();
});

test("conflito após prévia informa que nenhuma linha foi aplicada", async ({
  page,
}) => {
  const { number, move } = await prepare(page);
  await page.getByRole("button", { name: "Validar arquivo" }).click();
  await page
    .getByRole("checkbox", {
      name: `Substituir Cargo da matrícula ${number} pelo valor importado`,
    })
    .check();
  expect((await move(2, "Correção mais recente")).status()).toBe(201);
  await page.getByRole("button", { name: "Aplicar 1 linha válida" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        "Nenhuma linha foi aplicada. Revise os erros e valide novamente o arquivo.",
        { exact: true },
      ),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Importação aplicada.", { exact: true }),
  ).toHaveCount(0);
});

test("importação não desliga cadastro manual nem sessão sem confirmação explícita", async ({
  page,
  playwright,
}) => {
  await page.request.post("/api/auth/login", {
    headers,
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  const { units, categories } = await (
    await page.request.get("/api/employment-options")
  ).json();
  const number = `LEGACY-${Date.now()}`;
  const { personId } = await (
    await page.request.post("/api/people", {
      headers,
      data: {
        fullName: "Cadastro Manual Preservado",
        employment: {
          employeeNumber: number,
          unitId: units[0].id,
          categoryId: categories[0].id,
          startDate: "2020-01-01",
          jobTitle: "Analista",
        },
      },
    })
  ).json();
  const email = `legacy-${Date.now()}@local.invalid`;
  const password = "Legacy-E2E-Password-123";
  await page.request.post("/api/admin/users", {
    headers,
    data: { personId, email, temporaryPassword: password },
  });
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  try {
    expect(
      (
        await worker.post("/api/auth/login", { data: { email, password } })
      ).status(),
    ).toBe(200);
    const csv = [
      "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
      `${number},Cadastro Manual Preservado,,,nao,Efetivo Legado,LEGS,Unidade Legado,Analista,2020-01-01,nao`,
    ].join("\n");
    const result = await (
      await page.request.post("/api/imports/people", {
        headers,
        data: { filename: "legado.csv", csv, mode: "apply" },
      })
    ).json();
    expect(result.successfulRows).toBe(1);
    expect(
      (
        await (
          await page.request.get(`/api/people/${personId}/employment-history`)
        ).json()
      ).employments[0].endDate,
    ).toBeNull();
    expect((await worker.get("/api/auth/me")).status()).toBe(200);
    const preview = await (
      await page.request.post("/api/imports/people", {
        headers,
        data: { filename: "legado.csv", csv, mode: "preview" },
      })
    ).json();
    const confirmed = await (
      await page.request.post("/api/imports/people", {
        headers,
        data: {
          filename: "legado.csv",
          csv,
          mode: "apply",
          reconciliation: {
            previewId: preview.importRunId,
            fields: [{ employeeNumber: number, field: "employment.endDate" }],
          },
        },
      })
    ).json();
    expect(confirmed.successfulRows).toBe(1);
    expect((await worker.get("/api/auth/me")).status()).toBe(401);
  } finally {
    await worker.dispose();
  }
});
