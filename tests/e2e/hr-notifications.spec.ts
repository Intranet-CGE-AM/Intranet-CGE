import { clientHeaders, expect, test } from "./fixtures";

test("notificações de férias e checklists são privadas, deduplicadas e persistem a leitura", async ({
  playwright,
}) => {
  const clients = await Promise.all(
    [0, 1, 2].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [admin, worker, chief] = clients;
  try {
    const users = [];
    for (const [index, email] of [
      "admin-e2e@local.invalid",
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries()) {
      const response = await clients[index].post("/api/auth/login", {
        data: {
          email,
          password: index ? "Homolog-Password-2026" : "Admin-E2E-Password-123",
        },
      });
      expect(response.status()).toBe(200);
      users.push((await response.json()).user);
    }
    const created = await worker.post("/api/vacation-requests", {
      data: { startDate: "2048-03-01", endDate: "2048-03-05", submit: true },
    });
    expect(created.status()).toBe(201);
    const vacation = await created.json();
    const decision = () =>
      chief.post(`/api/vacation-requests/${vacation.id}/supervisor-decision`, {
        data: { decision: "approve", version: 1 },
      });
    expect((await decision()).status()).toBe(200);
    expect((await decision()).status()).toBe(409);
    const response = await worker.get("/api/notifications");
    expect(response.headers()["cache-control"]).toBe("no-store");
    const data = await response.json();
    const notices = data.notifications.filter((item: { href: string }) =>
      item.href.includes(vacation.id),
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      type: "vacation.updated",
      title: "Sua solicitação de férias foi atualizada",
      message: "Consulte o andamento na intranet.",
      readAt: null,
    });
    expect(
      (await chief.post(`/api/notifications/${notices[0].id}/read`)).status(),
    ).toBe(404);
    expect(
      (await worker.post(`/api/notifications/${notices[0].id}/read`)).status(),
    ).toBe(204);
    const firstRead = (
      await (await worker.get("/api/notifications")).json()
    ).notifications.find(
      (item: { id: string }) => item.id === notices[0].id,
    ).readAt;
    expect(firstRead).toBeTruthy();
    expect(
      (await worker.post(`/api/notifications/${notices[0].id}/read`)).status(),
    ).toBe(204);
    expect(
      (
        await (await worker.get("/api/notifications")).json()
      ).notifications.find((item: { id: string }) => item.id === notices[0].id)
        .readAt,
    ).toBe(firstRead);
    const templateResponse = await admin.post("/api/onboarding-templates", {
      data: {
        name: "Integração com notificações",
        kind: "entry",
        active: true,
        items: [
          {
            title: "Orientação reservada",
            area: "Servidor",
            required: true,
            active: true,
          },
        ],
      },
    });
    expect(templateResponse.status()).toBe(201);
    const checklistResponse = await admin.post("/api/checklists", {
      data: {
        personId: users[1].person.id,
        employmentId: users[1].employment.id,
        templateId: (await templateResponse.json()).id,
        assignments: [{ itemIndex: 0, accountId: users[1].account.id }],
      },
    });
    expect(checklistResponse.status()).toBe(201);
    const checklist = await checklistResponse.json();
    const assigned = (
      await (await worker.get("/api/notifications")).json()
    ).notifications.filter((item: { href: string }) =>
      item.href.includes(checklist.id),
    );
    expect(assigned).toHaveLength(1);
    expect(assigned[0]).toMatchObject({
      type: "checklist.assigned",
      title: "Você tem itens de checklist para concluir",
      message: "Consulte suas responsabilidades na intranet.",
      readAt: null,
    });
    expect(JSON.stringify(assigned)).not.toContain("Orientação reservada");
    expect((await worker.post("/api/notifications/read-all")).status()).toBe(
      204,
    );
    expect(
      (await (await worker.get("/api/notifications")).json()).unreadCount,
    ).toBe(0);
    expect((await worker.get("/api/notifications?page=0")).status()).toBe(400);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
