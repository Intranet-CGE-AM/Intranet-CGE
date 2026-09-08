import { createDatabase } from "../../apps/api/src/db/client.js";
import { clientHeaders, expect, test } from "./fixtures";

test("falha ao persistir aviso reverte decisão de férias e permite repetir com a mesma versão", async ({
  playwright,
}) => {
  const { client } = createDatabase(
    "postgresql://cge:cge@127.0.0.1:5432/intranet_cge_e2e",
  );
  const clients = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: "http://127.0.0.1:4173",
        extraHTTPHeaders: clientHeaders(),
      }),
    ),
  );
  const [worker, chief] = clients;
  let constrained = false;
  try {
    for (const [index, email] of [
      "caio.nascimento@homolog.cge.am.gov.br",
      "helena.monteiro@homolog.cge.am.gov.br",
    ].entries())
      expect(
        (
          await clients[index].post("/api/auth/login", {
            data: { email, password: "Homolog-Password-2026" },
          })
        ).status(),
      ).toBe(200);
    const created = await worker.post("/api/vacation-requests", {
      data: { startDate: "2048-06-01", endDate: "2048-06-05", submit: true },
    });
    expect(created.status()).toBe(201);
    const vacation = await created.json();
    // Falha real da persistência externa; comportamento e recuperação observados exclusivamente por HTTP.
    await client`alter table notifications add constraint notifications_e2e_reject_vacation check (type <> 'vacation.updated') not valid`;
    constrained = true;
    const decide = () =>
      chief.post(`/api/vacation-requests/${vacation.id}/supervisor-decision`, {
        data: { decision: "approve", version: 1 },
      });
    expect((await decide()).status()).toBe(500);
    const list = await (
      await worker.get("/api/vacation-requests?scope=mine")
    ).json();
    expect(
      list.requests.find((item: { id: string }) => item.id === vacation.id),
    ).toMatchObject({ version: 1, status: "submitted" });
    expect(
      (
        await (await worker.get("/api/notifications")).json()
      ).notifications.filter((item: { href: string }) =>
        item.href.includes(vacation.id),
      ),
    ).toEqual([]);
    await client`alter table notifications drop constraint notifications_e2e_reject_vacation`;
    constrained = false;
    expect((await decide()).status()).toBe(200);
    expect(
      (
        await (await worker.get("/api/notifications")).json()
      ).notifications.filter((item: { href: string }) =>
        item.href.includes(vacation.id),
      ),
    ).toHaveLength(1);
  } finally {
    if (constrained)
      await client`alter table notifications drop constraint notifications_e2e_reject_vacation`;
    await Promise.all(clients.map((context) => context.dispose()));
    await client.end();
  }
});
