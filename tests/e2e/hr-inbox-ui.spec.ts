import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("painel e caixa compartilham totais, filtros e recuperação acessível", async ({
  page,
}) => {
  const login = await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  const { user } = await login.json();
  const people = await (
    await page.request.get("/api/checklist-people?query=Caio")
  ).json();
  const person = people.people[0];
  const model = await page.request.post("/api/onboarding-templates", {
    data: {
      name: "Integração — conferência de documentos",
      kind: "entry",
      active: true,
      items: [
        {
          title: "Conferir cadastro",
          area: "Gestão de Pessoas",
          required: true,
          active: true,
        },
      ],
    },
  });
  expect(model.status()).toBe(201);
  const template = await model.json();
  for (let index = 0; index < 4; index++) {
    expect(
      (
        await page.request.post("/api/checklists", {
          data: {
            personId: person.personId,
            employmentId: person.employmentId,
            templateId: template.id,
            assignments: [{ itemIndex: 0, accountId: user.account.id }],
          },
        })
      ).status(),
    ).toBe(201);
  }
  const inbox = await (await page.request.get("/api/inbox")).json();
  expect(inbox.total).toBeGreaterThanOrEqual(5);
  const totalLabel = `${inbox.total} pendências para agir`;
  await page.goto("/rh");
  await expect(
    page.getByRole("heading", { name: "Minhas pendências", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(totalLabel, { exact: true })).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page
        .getByRole("region", { name: "Caixa de pendências" })
        .getByRole("listitem"),
    ).toHaveCount(5);
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
      path: `.impeccable/review/inbox-dashboard-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Ver todas as pendências" }).click();
  await expect(
    page.getByRole("heading", { name: "Minhas pendências", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(totalLabel, { exact: true })).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/inbox-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Tipo de pendência").selectOption("training");
  await expect(page.getByText("Nenhuma pendência neste filtro.")).toBeVisible();
  await page.route(
    "**/api/inbox?*",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Caixa temporariamente indisponível.",
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Atualizar pendências" }).click();
  await expect(
    page.getByText("Caixa temporariamente indisponível."),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma pendência neste filtro.")).toBeHidden();
  await page.getByRole("button", { name: "Tentar novamente" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nenhuma pendência neste filtro.")).toBeVisible();
});

test("atalho de atendimento abre a fila de gestão", async ({ page }) => {
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  await page.goto("/rh/solicitacoes?scope=team");
  await expect(
    page.getByRole("heading", {
      name: "Fila da Gestão de Pessoas",
      exact: true,
    }),
  ).toBeVisible();
});
