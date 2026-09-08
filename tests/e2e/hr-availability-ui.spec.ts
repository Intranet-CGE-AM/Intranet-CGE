import { clientHeaders, expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15000 });
test("chefia consulta disponibilidade e pendências em lista acessível e recupera falha", async ({
  page,
  playwright,
}) => {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker] = contexts;
  try {
    for (const [context, email, password] of [
      [admin, "admin-e2e@local.invalid", "Admin-E2E-Password-123"],
      [
        worker,
        "caio.nascimento@homolog.cge.am.gov.br",
        "Homolog-Password-2026",
      ],
      [
        page.request,
        "helena.monteiro@homolog.cge.am.gov.br",
        "Homolog-Password-2026",
      ],
    ] as const) {
      expect(
        (
          await context.post("/api/auth/login", { data: { email, password } })
        ).status(),
      ).toBe(200);
    }
    const request = await worker.post("/api/vacation-requests", {
      data: { startDate: "2037-02-10", endDate: "2037-02-12" },
    });
    expect(request.status()).toBe(201);
    const { id } = await request.json();
    expect(
      (
        await page.request.post(
          `/api/vacation-requests/${id}/supervisor-decision`,
          { data: { decision: "approve", version: 1 } },
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post(`/api/vacation-requests/${id}/hr-decision`, {
          data: { decision: "approve", version: 2 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await worker.post("/api/vacation-requests", {
          data: { startDate: "2037-02-20", endDate: "2037-02-22" },
        })
      ).status(),
    ).toBe(201);
    await page.goto("/rh/disponibilidade");
    await expect(
      page.getByRole("heading", {
        name: "Disponibilidade da equipe",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Data inicial").fill("2037-02-01");
    await page.getByLabel("Data final").fill("2037-02-28");
    await expect(
      page.getByRole("button", { name: "Consultar período" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Consultar período" }).focus();
    await page.keyboard.press("Enter");
    const absences = page.getByRole("region", {
      name: "Ausências confirmadas",
    });
    await expect(
      absences.getByText("Indisponível", { exact: true }),
    ).toBeVisible();
    await expect(
      absences.getByText("10/02/2037 a 12/02/2037", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Aguardando sua análise" })
        .getByRole("link", { name: "Analisar férias" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Integrantes da equipe" })
        .getByText("Caio Nascimento Almeida", { exact: true }),
    ).toBeVisible();
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
        path: `.impeccable/review/availability-${width}.png`,
        fullPage: true,
      });
    }
    await page.route(
      "**/api/team-availability?**",
      (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Consulta temporariamente indisponível.",
          }),
        }),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Consultar período" }).click();
    await expect(
      page.getByText("Consulta temporariamente indisponível.", { exact: true }),
    ).toBeVisible();
    await expect(absences).toBeHidden();
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(
      absences.getByText("Indisponível", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Data inicial")).toHaveValue("2037-02-01");
    await page.getByRole("button", { name: "Próximo mês" }).click();
    await expect(page.getByLabel("Data inicial")).toHaveValue("2037-03-01");
    await expect(
      page.getByText("Nenhuma ausência confirmada neste período.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Mês anterior" }).click();
    await page
      .getByRole("region", { name: "Aguardando sua análise" })
      .getByRole("link", { name: "Analisar férias" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Analisar solicitação" }),
    ).toBeVisible();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({
        path: `.impeccable/review/availability-decision-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    await Promise.all(contexts.map((context) => context.dispose()));
  }
});
