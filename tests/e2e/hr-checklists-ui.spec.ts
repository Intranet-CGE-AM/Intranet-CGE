import { clientHeaders, expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test("RH inicia checklist, registra desligamento com alerta e conclui providências", async ({
  page,
  playwright,
}) => {
  const adminLogin = await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  const admin = (await adminLogin.json()).user;
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  try {
    const { user } = await (
      await worker.post("/api/auth/login", {
        data: {
          email: "caio.nascimento@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const created = await page.request.post("/api/people", {
      data: {
        fullName: "Pessoa do checklist E2E",
        employment: {
          employeeNumber: `CHECK-${Date.now()}`,
          categoryId: user.employment.category.id,
          unitId: user.employment.unit.id,
          startDate: "2020-01-01",
          jobTitle: "Analista",
        },
      },
    });
    expect(created.status()).toBe(201);
    const person = await created.json();
    await page.goto("/rh/checklists");
    await expect(
      page.getByRole("heading", {
        name: "Checklists de ingresso e desligamento",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByText("Gerenciar modelos", { exact: true }).click();
    await page
      .getByRole("button", { name: "Novo modelo", exact: true })
      .click();
    await page
      .getByLabel("Nome do modelo")
      .fill("Saída administrativa da interface");
    await page.getByLabel("Tipo do checklist").selectOption("exit");
    await page
      .getByLabel("Título do item 1", { exact: true })
      .fill("Conferir devolução de acessos");
    await page.getByLabel("Área responsável 1", { exact: true }).fill("TI");
    await page
      .getByRole("button", { name: "Adicionar item", exact: true })
      .click();
    await page
      .getByLabel("Título do item 2", { exact: true })
      .fill("Acolher orientações finais");
    await page
      .getByLabel("Área responsável 2", { exact: true })
      .fill("Gestão de Pessoas");
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
        path: `.impeccable/review/checklist-model-${width}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Salvar modelo", exact: true })
      .click();
    await expect(
      page.getByText("Modelo salvo.", { exact: true }),
    ).toBeVisible();
    await page.getByText("Gerenciar modelos", { exact: true }).click();
    await page
      .getByRole("button", { name: "Iniciar checklist", exact: true })
      .click();
    await page.getByLabel("Buscar colaborador").fill("Pessoa do checklist E2E");
    await page
      .getByLabel("Colaborador", { exact: true })
      .selectOption(person.employmentId);
    await page
      .getByLabel("Modelo", { exact: true })
      .selectOption({ label: "Saída administrativa da interface" });
    await page
      .getByLabel("Responsável por: Conferir devolução de acessos", {
        exact: true,
      })
      .selectOption(admin.account.id);
    await page
      .getByLabel("Responsável por: Acolher orientações finais", {
        exact: true,
      })
      .selectOption(admin.account.id);
    await page
      .getByRole("button", { name: "Iniciar execução", exact: true })
      .click();
    await expect(
      page.getByText("Checklist iniciado.", { exact: true }),
    ).toBeVisible();
    const { checklists } = await (
      await page.request.get(
        `/api/checklists?scope=team&personId=${person.personId}`,
      )
    ).json();
    expect(checklists).toHaveLength(1);
    const execution = checklists[0];
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("button", { name: "Concluir", exact: true }).first(),
      ).toBeVisible();
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
        path: `.impeccable/review/checklist-execution-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto(`/rh/historico?personId=${person.personId}`);
    await page.getByLabel("Tipo de movimentação").selectOption("endDate");
    await expect(
      page.getByText("Checklist com providências pendentes", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/não impedem registrar o desligamento/),
    ).toBeVisible();
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Manaus",
    });
    await page.getByLabel("Vigência", { exact: true }).fill(today);
    await page
      .getByLabel("Justificativa", { exact: true })
      .fill(
        "Encerramento registrado sem bloquear providências administrativas.",
      );
    await page
      .getByRole("checkbox", { name: /Confirmo o desligamento/ })
      .check();
    await page
      .getByRole("button", { name: "Registrar movimentação", exact: true })
      .click();
    await expect(
      page.getByText("Movimentação registrada.", { exact: true }),
    ).toBeVisible();
    await page.goto(`/rh/checklists?checklistId=${execution.id}`);
    const firstItem = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", {
          name: "Conferir devolução de acessos",
          exact: true,
        }),
      })
      .last();
    await firstItem
      .getByRole("button", { name: "Concluir", exact: true })
      .click();
    await expect(
      firstItem.getByText("Concluído", { exact: true }),
    ).toBeVisible();
    const secondItem = page
      .getByRole("listitem")
      .filter({
        has: page.getByRole("heading", {
          name: "Acolher orientações finais",
          exact: true,
        }),
      })
      .last();
    await secondItem.getByText("Dispensar item", { exact: true }).click();
    await secondItem
      .getByLabel("Justificativa da dispensa")
      .fill("Providência já coberta no procedimento externo.");
    await secondItem
      .getByRole("button", { name: "Confirmar dispensa", exact: true })
      .click();
    await expect(
      secondItem.getByText("Dispensado", { exact: true }),
    ).toBeVisible();
    expect(
      (await (await page.request.get(`/api/checklists/${execution.id}`)).json())
        .progress,
    ).toEqual({ completed: 1, waived: 1, pending: 0, total: 2 });
  } finally {
    await worker.dispose();
  }
});
