import { clientHeaders, expect, test } from "./fixtures";
import { createDatabase } from "../../apps/api/src/db/client.js";

test("prazo médio considera somente solicitações concluídas no período, inclusive último dia de Manaus", async ({
  playwright,
}) => {
  const { client } = createDatabase(
    "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
  );
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  const worker = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: clientHeaders(),
  });
  let grantId: string | undefined;
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const { user } = await (
      await worker.post("/api/auth/login", {
        data: {
          email: "caio.nascimento@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const grant = await admin.post("/api/admin/permission-overrides", {
      data: {
        accountId: user.account.id,
        permission: "hr_requests.create",
        effect: "allow",
        unitId: user.employment.unit.id,
      },
    });
    expect(grant.status()).toBe(201);
    grantId = (await grant.json()).id;
    for (const [start, end] of [
      ["2002-01-01T12:00:00-04:00", "2002-01-05T12:00:00-04:00"],
      ["2002-01-03T23:30:00-04:00", "2002-01-05T23:30:00-04:00"],
      ["2002-01-01T00:00:00-04:00", "2002-01-06T00:00:00-04:00"],
    ]) {
      const created = await worker.post("/api/hr-requests", {
        data: {
          type: "declaration",
          description: "Declaração para aferição do prazo operacional.",
        },
      });
      expect(created.status()).toBe(201);
      const { id } = await created.json();
      expect(
        (
          await admin.post(`/api/hr-requests/${id}/transition`, {
            data: { action: "start", version: 1 },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await admin.post(`/api/hr-requests/${id}/transition`, {
            data: {
              action: "complete",
              version: 2,
              message: "Solicitação atendida pelo RH.",
            },
          })
        ).status(),
      ).toBe(200);
      // Fixture temporal externa: não há API para retroagir o relógio. As verificações seguem exclusivamente HTTP.
      await client`update hr_requests set created_at = ${start}, updated_at = ${end} where id = ${id}`;
      const visible = await (await worker.get(`/api/hr-requests/${id}`)).json();
      expect(Date.parse(visible.createdAt)).toBe(Date.parse(start));
      expect(Date.parse(visible.updatedAt)).toBe(Date.parse(end));
    }
    const result = await admin.get(
      `/api/hr-metrics?startDate=2002-01-05&endDate=2002-01-05&unitId=${user.employment.unit.id}`,
    );
    expect(result.status()).toBe(200);
    const metrics = await result.json();
    expect(metrics.completion).toEqual({ count: 2, averageHours: 72 });
    expect(metrics.requests).toEqual([]);
  } finally {
    if (grantId)
      await admin.delete(`/api/admin/permission-overrides/${grantId}`);
    await Promise.all([admin.dispose(), worker.dispose(), client.end()]);
  }
});
