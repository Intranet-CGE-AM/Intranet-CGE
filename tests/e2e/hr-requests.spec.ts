import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 15_000 });
test("RH configura previsão por tipo e servidor não altera a política", async ({
  playwright,
}) => {
  const context = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  });
  try {
    expect((await context.get("/api/hr-request-settings")).status()).toBe(401);
    await context.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    expect(
      (
        await context.put("/api/hr-request-settings/declaration", {
          data: { days: 7 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await context.get("/api/hr-request-settings")).json()).settings,
    ).toEqual(expect.arrayContaining([{ type: "declaration", days: 7 }]));
    await context.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    expect(
      (
        await context.put("/api/hr-request-settings/declaration", {
          data: { days: 365 },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.dispose();
  }
});
test("servidor abre solicitação e RH responde com controle de concorrência", async ({
  page,
  playwright,
}) => {
  const headers = { Origin: "http://127.0.0.1:4173" };
  expect((await page.request.get("/api/hr-requests")).status()).toBe(401);
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), ...headers },
  });
  let overrideId: string | undefined;
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin-e2e@local.invalid",
            password: "Admin-E2E-Password-123",
          },
        })
      ).ok(),
    ).toBe(true);
    const login = await page.request.post("/api/auth/login", {
      headers,
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    const { user } = await login.json();
    const override = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "hr_requests.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(override.status()).toBe(201);
    overrideId = (await override.json()).id;
    await page.goto("/rh/solicitacoes");
    await expect(
      page.getByRole("heading", { name: "Minhas solicitações" }),
    ).toBeVisible();
    await page.getByLabel("Tipo de solicitação").selectOption("declaration");
    await page
      .getByLabel("Como podemos ajudar?")
      .fill("Preciso de uma declaração de vínculo para matrícula no curso.");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(
      page.getByText(/Solicitação enviada. Protocolo/),
    ).toBeVisible();
    const { requests } = await (
      await page.request.get("/api/hr-requests")
    ).json();
    const item = requests.find(
      (item: { description: string }) =>
        item.description ===
        "Preciso de uma declaração de vínculo para matrícula no curso.",
    );
    expect(item).toBeTruthy();
    expect(item).toMatchObject({
      status: "submitted",
      type: "declaration",
      version: 1,
    });
    expect(item.protocol).toMatch(/^RH-/);
    expect(item.dueAt).toBeTruthy();
    expect(
      (await page.request.get("/api/hr-requests?scope=team")).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(`/api/hr-requests/${item.id}/transition`, {
          headers,
          data: {
            action: "complete",
            version: 1,
            message: "Tentativa sem permissão",
          },
        })
      ).status(),
    ).toBe(403);
    const assumed = await admin.post(`/api/hr-requests/${item.id}/transition`, {
      data: { action: "start", version: 1 },
    });
    expect(assumed.status()).toBe(200);
    expect(
      (
        await admin.post(`/api/hr-requests/${item.id}/transition`, {
          data: {
            action: "complete",
            version: 1,
            message: "Documento disponível na Gestão de Pessoas.",
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.post(`/api/hr-requests/${item.id}/transition`, {
          data: {
            action: "complete",
            version: 2,
            message: "Documento disponível na Gestão de Pessoas.",
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: item.protocol })
        .getByText("Concluída", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Documento disponível na Gestão de Pessoas."),
    ).toBeVisible();
    const detail = await (
      await page.request.get(`/api/hr-requests/${item.id}`)
    ).json();
    expect(detail.events.map((event: { type: string }) => event.type)).toEqual([
      "submitted",
      "start",
      "complete",
    ]);
    const notices = (
      await (await page.request.get("/api/notifications")).json()
    ).notifications.filter((notice: { href: string }) =>
      notice.href.includes(item.id),
    );
    expect(notices).toHaveLength(2);
    expect(
      notices.every(
        (notice: { message: string }) =>
          notice.message === "Consulte o andamento na intranet.",
      ),
    ).toBe(true);
    expect(JSON.stringify(notices)).not.toContain("matrícula no curso");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.impeccable/review/requests-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
  }
});
