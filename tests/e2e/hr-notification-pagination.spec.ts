import { clientHeaders, expect, test } from "./fixtures";

test.use({ actionTimeout: 15000 });
test("histórico pagina avisos por conta sem repetição e leitura em lote não afeta outra conta", async ({
  playwright,
  page,
}) => {
  const clients = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, owner, other] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "thiago.freitas@homolog.cge.am.gov.br",
      "caio.nascimento@homolog.cge.am.gov.br",
    ].entries()) {
      const login = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(login.status()).toBe(200);
      users.push((await login.json()).user);
    }
    const before = (await (await owner.get("/api/notifications")).json())
      .unreadCount;
    const templateResponse = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Paginação de responsabilidades",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Conferir instruções",
            area: "Servidor",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(templateResponse.status()).toBe(201);
    const template = await templateResponse.json();
    for (let index = 0; index < 51; index++)
      expect(
        (
          await admin.post("/api/checklists", {
            data: {
              personId: users[1].person.id,
              employmentId: users[1].employment.id,
              templateId: template.id,
              assignments: [{ itemIndex: 0, accountId: users[1].account.id }],
            },
          })
        ).status(),
      ).toBe(201);
    const first = await (await owner.get("/api/notifications?page=1")).json();
    const second = await (await owner.get("/api/notifications?page=2")).json();
    expect(first.notifications).toHaveLength(50);
    expect(first.hasMore).toBe(true);
    expect(first.unreadCount).toBe(before + 51);
    expect(second.notifications.length).toBeGreaterThan(0);
    const ids = [...first.notifications, ...second.notifications].map(
      (item: { id: string }) => item.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    const otherBefore = await (await other.get("/api/notifications")).json();
    expect(
      otherBefore.notifications.some((item: { id: string }) =>
        ids.includes(item.id),
      ),
    ).toBe(false);
    expect((await owner.post("/api/notifications/read-all")).status()).toBe(
      204,
    );
    expect(
      (await (await owner.get("/api/notifications?page=2")).json()).unreadCount,
    ).toBe(0);
    expect(
      (await (await other.get("/api/notifications")).json()).unreadCount,
    ).toBe(otherBefore.unreadCount);
    await page.request.post("/api/auth/login", {
      data: {
        email: "thiago.freitas@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });
    await page.goto("/notificacoes");
    await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
    await page.route("**/api/notifications?page=2", (route) =>
      route.fulfill({ status: 503, json: { message: "Falha de consulta" } }),
    );
    await page.getByRole("button", { name: "Próxima", exact: true }).click();
    await expect(
      page.getByText(
        "Não foi possível carregar as notificações. Tente novamente.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Carregando notificações…", { exact: true }),
    ).toHaveCount(0);
    await page.unroute("**/api/notifications?page=2");
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/notifications?page=2", async (route) => {
      await delayed;
      await route.continue();
    });
    try {
      await page.getByRole("button", { name: "Próxima", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Próxima", exact: true }),
      ).toBeDisabled();
      await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
    } finally {
      release();
    }
    await expect(page.getByText("Página 2", { exact: true })).toBeVisible();
    await page.unroute("**/api/notifications?page=2");
    await page.route("**/api/notifications?page=*", (route) =>
      route.fulfill({ status: 503, json: { message: "Falha inicial" } }),
    );
    await page.reload();
    await expect(
      page.getByText(
        "Não foi possível carregar as notificações. Tente novamente.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Carregando notificações…", { exact: true }),
    ).toHaveCount(0);
    await page.unroute("**/api/notifications?page=*");
    await page
      .getByRole("button", { name: "Tentar novamente", exact: true })
      .click();
    await expect(page.getByText("Página 1", { exact: true })).toBeVisible();
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
