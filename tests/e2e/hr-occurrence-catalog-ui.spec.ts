import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15000 });
test("RH configura exigências e desativa tipo de ocorrência pela interface", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const policy = await page.request.post("/api/document-types", {
    data: {
      name: "Política de comprovantes da interface",
      purpose: "Analisar justificativas funcionais",
      policyReference: "Norma interna de homologação",
      retentionDays: 180,
      sensitive: true,
    },
  });
  expect(policy.status()).toBe(201);
  await page.goto("/rh/ocorrencias");
  await page
    .getByText("Administrar tipos de ocorrência", { exact: true })
    .click();
  await page
    .getByLabel("Nome do tipo")
    .fill("Registro administrativo configurado");
  await page.getByLabel("Exigir análise da chefia").uncheck();
  await page.getByLabel("Exigir comprovante").check();
  await page.getByLabel("Política documental").selectOption({
    label: "Política de comprovantes da interface · Sensível",
  });
  await page.getByRole("button", { name: "Salvar tipo", exact: true }).click();
  await expect(page.getByText("Tipo salvo.", { exact: true })).toBeVisible();
  const types = (await (await page.request.get("/api/occurrence-types")).json())
    .types;
  const item = types.find(
    (type: { name: string }) =>
      type.name === "Registro administrativo configurado",
  );
  expect(item).toMatchObject({
    active: true,
    requiresSupervisor: false,
    requiresRH: true,
    requiresDocument: true,
  });
  await page.getByLabel("Tipo para administrar").selectOption(item.id);
  await page.getByLabel("Tipo ativo").uncheck();
  await page.getByRole("button", { name: "Salvar tipo", exact: true }).click();
  await expect(page.getByText("Tipo salvo.", { exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (
          await (await page.request.get("/api/occurrence-types")).json()
        ).types.find((type: { id: string }) => type.id === item.id).active,
    )
    .toBe(false);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: `.impeccable/review/occurrence-catalog-${width}.png`,
      fullPage: true,
    });
  }
});
