import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test("permissão de histórico funcional não revela nascimento sem people.manage", async ({
  playwright,
}) => {
  const options = {
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  };
  const admin = await playwright.request.newContext(options);
  const viewer = await playwright.request.newContext(options);
  let overrideId: string | undefined;
  try {
    await admin.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const { user } = await (
      await viewer.post("/api/auth/login", {
        data: {
          email: "leonardo.araujo@homolog.cge.am.gov.br",
          password: "Homolog-Password-2026",
        },
      })
    ).json();
    const {
      people: [person],
    } = await (await admin.get("/api/people?query=Dandara")).json();
    overrideId = (
      await (
        await admin.post("/api/admin/permission-overrides", {
          data: {
            accountId: user.account.id,
            permission: "employment.manage_history",
            effect: "allow",
            unitId: person.employment.unitId,
          },
        })
      ).json()
    ).id;
    const limited = await viewer.get(
      `/api/people/${person.id}/employment-history`,
    );
    expect(limited.status()).toBe(200);
    expect(
      (await limited.json()).provenance.some(
        (item: { field: string }) => item.field === "birthDate",
      ),
    ).toBe(false);
    const allowed = await (
      await admin.get(`/api/people/${person.id}/employment-history`)
    ).json();
    expect(allowed.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "birthDate",
          value: person.birthDate,
        }),
      ]),
    );
  } finally {
    if (overrideId)
      await admin.delete(`/api/admin/permission-overrides/${overrideId}`);
    await admin.dispose();
    await viewer.dispose();
  }
});
