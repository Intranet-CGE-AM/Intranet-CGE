import {
  clientHeaders,
  expect,
  test,
  type APIRequestContext,
} from "./fixtures";

test.use({ actionTimeout: 15_000 });

async function enableRequests(
  admin: APIRequestContext,
  worker: APIRequestContext,
) {
  expect(
    (
      await admin.post("/api/auth/login", {
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const login = await worker.post("/api/auth/login", {
    data: {
      email: "caio.nascimento@homolog.cge.am.gov.br",
      password: "Homolog-Password-2026",
    },
  });
  expect(login.status()).toBe(200);
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
  return (await override.json()).id as string;
}

test("link direto não oferece ações do solicitante ao gestor que consulta outra pessoa", async ({
  page,
  playwright,
}) => {
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let overrideId: string | undefined;
  try {
    overrideId = await enableRequests(page.request, worker);
    const created = await worker.post("/api/hr-requests", {
      data: {
        type: "declaration",
        description: "Declaração para teste de titularidade da interface.",
      },
    });
    expect(created.status()).toBe(201);
    const record = await created.json();
    await page.goto(`/rh/solicitacoes?requestId=${record.id}`);
    await expect(
      page.getByText(record.protocol, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancelar", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.post(`/api/hr-requests/${record.id}/transition`, {
          data: { action: "start", version: 1 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post(`/api/hr-requests/${record.id}/transition`, {
          data: {
            action: "request_information",
            version: 2,
            message: "Informe a finalidade administrativa.",
            deadline: "2040-01-01",
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(
      page
        .getByText("Informe a finalidade administrativa.", { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByLabel("Informações complementares", { exact: true }),
    ).toHaveCount(0);
  } finally {
    if (overrideId)
      await page.request.delete(
        `/api/admin/permission-overrides/${overrideId}`,
      );
    await worker.dispose();
  }
});

test("resposta atrasada da lista pessoal não substitui a fila selecionada", async ({
  page,
  playwright,
}) => {
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delivered = () => {};
  const delivery = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  let overrideId: string | undefined;
  try {
    overrideId = await enableRequests(page.request, worker);
    const created = await worker.post("/api/hr-requests", {
      data: {
        type: "other",
        description: "Demanda que deve continuar visível na fila escolhida.",
      },
    });
    expect(created.status()).toBe(201);
    const record = await created.json();
    let held = false;
    await page.route("**/api/hr-requests?scope=mine&*", async (route) => {
      const response = await route.fetch();
      held = true;
      await gate;
      await route.fulfill({ response }).catch(() => {});
      delivered();
    });
    await page.goto("/rh/solicitacoes");
    await expect.poll(() => held).toBe(true);
    await page
      .getByRole("button", { name: "Fila da Gestão de Pessoas", exact: true })
      .click();
    await expect(
      page.getByText(record.protocol, { exact: true }),
    ).toBeVisible();
    release();
    await delivery;
    // The delayed HTTP response has a full render opportunity; no internal state is inspected.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      page.getByText(record.protocol, { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Filtrar por situação").selectOption("submitted");
    await expect(
      page.getByText(record.protocol, { exact: true }),
    ).toBeVisible();
  } finally {
    release();
    if (overrideId)
      await page.request.delete(
        `/api/admin/permission-overrides/${overrideId}`,
      );
    await worker.dispose();
  }
});
