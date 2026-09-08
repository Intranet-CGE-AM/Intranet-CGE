import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15_000 });
test("RH confirma um campo divergente na prévia antes de substituir valor manual", async ({
  page,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  await page.request.post("/api/auth/login", {
    headers,
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  const number = `RECUI-${Date.now()}`;
  const csv = [
    "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
    `${number},Reconciliação Interface,,,nao,Efetivo Reconciliação,RECUI,Unidade Reconciliação,Analista importado,2020-01-01,sim`,
  ].join("\n");
  expect(
    (
      await page.request.post("/api/imports/people", {
        headers,
        data: { filename: "reconciliacao.csv", csv, mode: "apply" },
      })
    ).status(),
  ).toBe(200);
  const {
    people: [person],
  } = await (await page.request.get(`/api/people?query=${number}`)).json();
  expect(
    (
      await page.request.post(`/api/people/${person.id}/movements`, {
        headers,
        data: {
          expectedVersion: 1,
          effectiveOn: "2026-09-07",
          reason: "Ajuste manual conferido pelo RH",
          changes: { jobTitle: "Analista manual" },
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/rh/colaboradores");
  await page.getByRole("button", { name: "Importar CSV" }).click();
  await page.getByLabel("Arquivo CSV").setInputFiles({
    name: "reconciliacao.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Validar arquivo" }).click();
  const choice = page.getByRole("checkbox", {
    name: `Substituir Cargo da matrícula ${number} pelo valor importado`,
  });
  await expect(choice).not.toBeChecked();
  await expect(
    page.getByText("Analista manual", { exact: true }),
  ).toBeVisible();
  await choice.check();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `.impeccable/review/reconciliation-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Aplicar 1 linha válida" }).click();
  await expect(
    page.getByRole("dialog").getByText("Importação aplicada.", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/people/${person.id}/employment-history`)
      ).json()
    ).employments[0].jobTitle,
  ).toBe("Analista importado");
});
