import { expect, test } from "./fixtures";
test.use({ actionTimeout: 15000 });

test("conflitos de associação e hierarquia preservam a intenção e pedem novo salvamento", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const unitResponse = await page.request.post("/api/organization-units", {
    data: {
      code: `ORG-REF-${Date.now()}`,
      name: "Unidade para referências concorrentes",
    },
  });
  expect(unitResponse.status()).toBe(201);
  const unit = await unitResponse.json();
  const options = await (
    await page.request.get("/api/employment-options")
  ).json();
  const personResponse = await page.request.post("/api/people", {
    data: {
      fullName: "Pessoa com associação concorrente",
      employment: {
        employeeNumber: `ORG-REF-${Date.now()}`,
        unitId: unit.id,
        categoryId: options.categories[0].id,
        startDate: "2020-01-01",
      },
    },
  });
  expect(personResponse.status()).toBe(201);
  const person = await personResponse.json();
  const positions = [];
  for (const [code, title] of [
    ["INTENT", "Cargo pretendido"],
    ["OTHER", "Cargo paralelo"],
  ]) {
    const response = await page.request.post("/api/organization/positions", {
      data: { unitId: unit.id, code, title, plannedCount: 2, active: true },
    });
    expect(response.status()).toBe(201);
    positions.push(await response.json());
  }
  await page.goto("/rh/estrutura");
  await page.getByLabel("Unidade consultada").selectOption(unit.id);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Pessoa com associação concorrente" });
  await row.getByLabel("Cargo do quadro").selectOption(positions[0].id);
  expect(
    (
      await page.request.post(
        `/api/organization/employments/${person.employmentId}/position`,
        { data: { positionId: positions[1].id, version: 1 } },
      )
    ).status(),
  ).toBe(200);
  await row.getByRole("button", { name: "Salvar associação" }).click();
  await expect(
    page.getByText("O vínculo foi alterado. Atualize antes de continuar."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Atualizar dados sem perder edição" })
    .click();
  await expect(row.getByLabel("Cargo do quadro")).toHaveValue(positions[0].id);
  await expect(row).toContainText("Associação atual: Cargo paralelo.");
  async function currentUnit() {
    const view = await (await page.request.get("/api/organization")).json();
    return view.units.find((item: { id: string }) => item.id === unit.id);
  }
  expect((await currentUnit()).employments[0]).toMatchObject({
    positionId: positions[1].id,
    version: 2,
  });
  await row.getByRole("button", { name: "Salvar associação" }).click();
  await expect(
    page.getByText("Associação salva.", { exact: true }),
  ).toBeVisible();
  expect((await currentUnit()).employments[0]).toMatchObject({
    positionId: positions[0].id,
    version: 3,
  });
  await page.getByRole("button", { name: "Alterar unidade superior" }).click();
  await page
    .getByLabel("Unidade superior")
    .selectOption({ label: "Tecnologia da Informação" });
  const parallel = options.units.find(
    (item: { name: string }) => item.name === "Controle Interno",
  );
  expect(
    (
      await page.request.put(`/api/organization/units/${unit.id}/parent`, {
        data: { parentId: parallel.id, expectedParentId: null },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Salvar hierarquia" }).click();
  await expect(
    page.getByText("A hierarquia foi alterada. Atualize antes de continuar."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Atualizar dados sem perder edição" })
    .click();
  await expect(
    page.getByText("Unidade superior: Controle Interno", { exact: true }),
  ).toBeVisible();
  expect((await currentUnit()).parentId).toBe(parallel.id);
  await expect(
    page.getByLabel("Unidade superior").locator("option:checked"),
  ).toHaveText("Tecnologia da Informação");
  await page.getByRole("button", { name: "Salvar hierarquia" }).click();
  await expect(
    page.getByText("Hierarquia salva.", { exact: true }),
  ).toBeVisible();
  expect((await currentUnit()).parentId).toBe(
    options.units.find(
      (item: { name: string }) => item.name === "Tecnologia da Informação",
    ).id,
  );
});

test("conflito de cargo atualiza a referência sem perder edição nem salvar automaticamente", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: {
          email: "admin-e2e@local.invalid",
          password: "Admin-E2E-Password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const createdUnit = await page.request.post("/api/organization-units", {
    data: {
      code: `ORG-CONF-${Date.now()}`,
      name: "Unidade de revisão concorrente",
    },
  });
  expect(createdUnit.status()).toBe(201);
  const unit = await createdUnit.json();
  const input = {
    unitId: unit.id,
    code: "CONFLICT",
    title: "Cargo antes da revisão",
    plannedCount: 2,
    active: true,
  };
  const created = await page.request.post("/api/organization/positions", {
    data: input,
  });
  expect(created.status()).toBe(201);
  const position = await created.json();
  await page.goto("/rh/estrutura");
  await page.getByLabel("Unidade consultada").selectOption(unit.id);
  await page.getByRole("button", { name: "Editar cargo", exact: true }).click();
  await page.getByLabel("Nome do cargo").fill("Cargo digitado e preservado");
  expect(
    (
      await page.request.put(`/api/organization/positions/${position.id}`, {
        data: {
          ...input,
          title: "Cargo salvo por outro gestor",
          plannedCount: 5,
          version: 1,
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).click();
  await expect(
    page.getByText("O cargo foi alterado. Atualize antes de continuar."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Atualizar dados sem perder edição" })
    .click();
  await expect(page.getByLabel("Nome do cargo")).toHaveValue(
    "Cargo digitado e preservado",
  );
  await expect(page.getByLabel("Quantidade prevista")).toHaveValue("2");
  await expect(
    page.getByRole("table", { name: "Cargos da unidade" }),
  ).toContainText("Cargo salvo por outro gestor");
  await expect(page.getByText(/Dados atuais carregados/)).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.impeccable/review/organization-conflict-${width}.png`,
      fullPage: true,
    });
  }
  let view = await (await page.request.get("/api/organization")).json();
  expect(
    view.units.find((item: { id: string }) => item.id === unit.id).positions[0],
  ).toMatchObject({
    title: "Cargo salvo por outro gestor",
    plannedCount: 5,
    version: 2,
  });
  await page.getByRole("button", { name: "Salvar cargo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Cargo salvo.", { exact: true })).toBeVisible();
  view = await (await page.request.get("/api/organization")).json();
  expect(
    view.units.find((item: { id: string }) => item.id === unit.id).positions[0],
  ).toMatchObject({
    title: "Cargo digitado e preservado",
    plannedCount: 2,
    version: 3,
  });
});
