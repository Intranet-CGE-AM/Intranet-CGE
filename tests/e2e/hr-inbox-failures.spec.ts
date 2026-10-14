import { createDatabase } from "../../apps/api/src/db/client.js";
import { expect, test } from "./fixtures";

test("fonte indisponível preserva as outras pendências e registra auditoria", async ({
  page,
}) => {
  const { client } = createDatabase(
    "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
  );
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  let renamed = false;
  try {
    const before = await (await page.request.get("/api/inbox")).json();
    expect(
      before.items.some((item: { type: string }) => item.type === "vacation"),
    ).toBe(true);
    // Falha real de infraestrutura, somente no banco descartável E2E; nenhuma leitura de estado interno para verificar comportamento.
    await client`alter table training_records rename to training_records_unavailable_e2e`;
    renamed = true;
    const response = await page.request.get("/api/inbox");
    expect(response.status()).toBe(200);
    const partial = await response.json();
    expect(partial.sourcesUnavailable).toEqual(["training"]);
    expect(
      partial.items.filter(
        (item: { type: string }) => item.type === "vacation",
      ),
    ).toEqual(
      before.items.filter((item: { type: string }) => item.type === "vacation"),
    );
    await page.goto("/rh/pendencias");
    await expect(
      page.getByText("Consulta parcial", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Não foi possível consultar: Capacitações/),
    ).toBeVisible();
    const audit = await (
      await page.request.get(
        "/api/audit-events?action=inbox.source-unavailable",
      )
    ).json();
    expect(audit.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "failure",
          metadata: { source: "training" },
        }),
      ]),
    );
    await client`alter table training_records_unavailable_e2e rename to training_records`;
    renamed = false;
    await page.getByRole("button", { name: "Atualizar pendências" }).click();
    await expect(
      page.getByText("Consulta parcial", { exact: true }),
    ).toBeHidden();
  } finally {
    if (renamed)
      await client`alter table training_records_unavailable_e2e rename to training_records`;
    await client.end();
  }
});
