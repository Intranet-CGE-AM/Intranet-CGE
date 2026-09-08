import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test.use({ actionTimeout: 15_000 });

test("dossiê sem vínculo orienta procurar Gestão de Pessoas", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("E-mail institucional")
    .fill("renata.martins@homolog.cge.am.gov.br");
  await page.getByLabel("Senha").fill("Homolog-Password-2026");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: "Bom dia, Renata" }),
  ).toBeVisible();
  const response = await page.request.get("/api/me/dossier");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    fullName: "Renata Martins Queiroz",
    employment: null,
  });
  await page.goto("/rh/meu-dossie");
  await expect(page.getByText(/Você não possui vínculo ativo/)).toBeVisible();
});

test("férias permitem informar datas diretamente sem calendário adicional", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("E-mail institucional")
    .fill("caio.nascimento@homolog.cge.am.gov.br");
  await page.getByLabel("Senha").fill("Homolog-Password-2026");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: "Bom dia, Caio" }),
  ).toBeVisible();
  await page.goto("/rh/ferias");
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial", { exact: true }).fill("2029-04-02");
  await page.getByLabel("Data final", { exact: true }).fill("2029-04-06");
  await expect(
    page.getByText("5 dias corridos", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: ".impeccable/review/vacations-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/vacations-1280.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enviar para chefia" }).last().click();
  await expect(
    page.getByText("Solicitação enviada para a chefia."),
  ).toBeVisible();
  const response = await page.request.get("/api/vacation-requests?scope=mine");
  expect((await response.json()).requests).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        startDate: "2029-04-02",
        endDate: "2029-04-06",
        status: "submitted",
      }),
    ]),
  );
});

test("servidor consulta somente seu dossiê, inclusive no celular", async ({
  page,
}) => {
  expect((await page.request.get("/api/me/dossier")).status()).toBe(401);
  await page.goto("/login");
  await page
    .getByLabel("E-mail institucional")
    .fill("caio.nascimento@homolog.cge.am.gov.br");
  await page.getByLabel("Senha").fill("Homolog-Password-2026");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: "Bom dia, Caio" }),
  ).toBeVisible();
  const response = await page.request.get("/api/me/dossier");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    fullName: "Caio Nascimento Almeida",
    employment: { employeeNumber: "HOM-003" },
  });
  expect(
    (
      await page.request.get(
        "/api/me/dossier?personId=00000000-0000-4000-8000-000000000001",
      )
    ).status(),
  ).toBe(400);
  await page.goto("/rh/meu-dossie");
  await expect(page.getByRole("heading", { name: "Meu dossiê" })).toBeVisible();
  await expect(page.getByText("HOM-003", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Helena Monteiro Ferreira", { exact: true }),
  ).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/dossier-${width}.png`,
      fullPage: true,
    });
  }
});
