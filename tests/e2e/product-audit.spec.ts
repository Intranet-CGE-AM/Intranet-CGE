import AxeBuilder from "@axe-core/playwright";
import type { Person } from "@cge/contracts";
import { expect, test, type Page } from "@playwright/test";

const password = "Homolog-Password-2026";
const accounts = {
  contractor: "dandara.ribeiro@homolog.cge.am.gov.br",
  disabled: "patricia.mota@homolog.cge.am.gov.br",
  emptyScope: "thiago.freitas@homolog.cge.am.gov.br",
  firstAccess: "luiza.barreto@homolog.cge.am.gov.br",
  hr: "marina.rocha@homolog.cge.am.gov.br",
  inactiveEmployment: "renata.martins@homolog.cge.am.gov.br",
  noAccess: "ana.vasconcelos@homolog.cge.am.gov.br",
  supervisor: "helena.monteiro@homolog.cge.am.gov.br",
  viewer: "leonardo.araujo@homolog.cge.am.gov.br",
  worker: "caio.nascimento@homolog.cge.am.gov.br",
};
const admin = {
  email: "admin-e2e@local.invalid",
  password: "Admin-E2E-Password-123",
};

test("default home exposes permitted destinations and account context", async ({
  page,
}) => {
  await login(page, accounts.worker, password);
  await expect(page.getByRole("heading", { name: "Olá, Caio." })).toBeVisible();

  const hrModule = page.getByRole("region", { name: "Recursos Humanos" });
  await expect(
    hrModule.getByRole("link", { name: "Entrar no módulo" }),
  ).toHaveAttribute("href", "/rh");
  await expect(
    hrModule.getByRole("link", { name: "Colaboradores" }),
  ).toHaveAttribute("href", "/rh/colaboradores");
  await expect(hrModule.getByRole("link", { name: "Férias" })).toHaveAttribute(
    "href",
    "/rh/ferias",
  );
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Administração", exact: true }),
  ).toHaveCount(0);

  const accountContext = page.getByRole("region", {
    name: "Contexto da conta",
  });
  await expect(
    accountContext.getByText("Tecnologia da Informação", { exact: true }),
  ).toBeVisible();
  await expect(
    accountContext.getByText(accounts.worker, { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Abrir menu da conta de Caio Nascimento" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Alterar senha" }),
  ).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Minha conta" }),
  ).toBeVisible();
  await expect(page.getByText(accounts.worker, { exact: true })).toBeVisible();
  await expectAccessiblePage(page, "/conta", 1280);

  const accountAvatarPicker = page.getByLabel(
    "Selecionar nova foto de Caio Nascimento",
  );
  await accountAvatarPicker.hover();
  await expect(page.getByText("Adicionar", { exact: true })).toBeVisible();
  await accountAvatarPicker.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const profile = page.getByRole("region", { name: "Perfil" });
  await expect(profile.locator('[data-slot="avatar"] img')).toBeVisible();
  await expect(profile.getByText("avatar.png", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByText("Foto de perfil atualizada.")).toBeVisible();
  await expect(
    page.locator('main [data-slot="avatar"] img').first(),
  ).toBeVisible();
  const removePhoto = page.getByRole("button", {
    name: "Remover foto",
    exact: true,
  });
  await removePhoto.click();
  const removePhotoDialog = page.getByRole("alertdialog", {
    name: "Remover sua foto?",
  });
  await expect(removePhotoDialog).toBeVisible();
  await expectAccessiblePage(page, "confirmação de remoção de foto", 1280);
  await page.keyboard.press("Escape");
  await expect(removePhotoDialog).toHaveCount(0);
  await expect(removePhoto).toBeFocused();
  await removePhoto.click();
  await page
    .getByRole("alertdialog", { name: "Remover sua foto?" })
    .getByRole("button", { name: "Remover foto" })
    .click();
  await expect(page.getByText("Foto de perfil removida.")).toBeVisible();
});

test("homolog worker sees every vacation state and immutable history", async ({
  page,
}) => {
  await login(page, accounts.worker, password);
  await page
    .getByRole("link", { name: "Recursos Humanos", exact: true })
    .click();
  await expect(page.getByText(/solicitações em andamento/)).toBeVisible();
  await expect(page.getByText(/ações pendentes/)).toHaveCount(0);
  await openHrRoute(page, "Férias");
  await expect(
    page.getByRole("list", { name: "Etapas do fluxo de férias" }),
  ).toContainText("EnvioChefia imediataDecisão final da Gestão de Pessoas");
  for (const label of [
    "Rascunho",
    "Aguardando chefia",
    "Aguardando decisão final",
    "Rejeitada pela chefia",
    "Aprovada",
    "Rejeitada na decisão final",
    "Cancelada",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Histórico" }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Histórico da solicitação" }),
  ).toBeVisible();
  await expect(page.getByText("Solicitação criada")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  const approvedBySupervisor = page
    .getByRole("row")
    .filter({ hasText: "Aguardando decisão final" });
  await approvedBySupervisor.getByRole("button", { name: "Histórico" }).click();
  await expect(page.getByText("Aprovada pela chefia")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2027-05-01");
  await page.getByLabel("Data final").fill("2027-05-10");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Rascunho salvo/)).toBeVisible();
  const newDraft = page.getByRole("row").filter({ hasText: "01 de mai." });
  await expect(
    newDraft.getByRole("button", { name: "Enviar para chefia" }),
  ).toBeVisible();
});

test("unit scopes suppress unrelated people and modules", async ({ page }) => {
  await login(page, accounts.viewer, password);
  const navigation = page.getByRole("navigation", {
    name: "Navegação principal",
  });
  await expect(
    navigation.getByRole("link", { name: "Recursos Humanos", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Férias", exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole("link", {
      name: "Administração",
      exact: true,
    }),
  ).toHaveCount(0);
  await navigation
    .getByRole("link", { name: "Recursos Humanos", exact: true })
    .click();
  await expect(
    navigation.getByRole("link", { name: "Colaboradores", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Férias", exact: true }),
  ).toHaveCount(0);
  await navigation
    .getByRole("link", { name: "Colaboradores", exact: true })
    .click();
  await expect(
    page.getByText("Leonardo Araújo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ana Beatriz Vasconcelos", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Caio Nascimento", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("searchbox", { name: "Buscar colaboradores" })
    .fill("registro inexistente");
  await expect(
    page.getByRole("heading", { name: "Nenhum resultado" }),
  ).toBeVisible();
  await expect(page.locator('[data-slot="empty-state"] svg')).toHaveCount(0);
});

test("employee directory paginates and searches on the server", async ({
  page,
}) => {
  await login(page, admin.email, admin.password);
  await openHrRoute(page, "Colaboradores");

  const response = await page.request.get("/api/people?pageSize=1");
  const total = (await response.json()).pagination.total as number;
  const table = page.getByRole("table", {
    name: "Diretório de colaboradores",
  });
  await expect(table.getByRole("row")).toHaveCount(Math.min(10, total) + 1);
  await expect(
    page.getByText(`1–${Math.min(10, total)} de ${total} colaboradores`),
  ).toBeVisible();

  await chooseOption(page, "Itens por página", "5");
  await expect(table.getByRole("row")).toHaveCount(6);
  await expect(page.getByText(`1–5 de ${total} colaboradores`)).toBeVisible();
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(
    page.getByText(`6–${Math.min(10, total)} de ${total} colaboradores`),
  ).toBeVisible();

  await page.route("**/api/people?*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get("query") === "Ana Beatriz") {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });
  const serverSearch = page.waitForRequest((request) => {
    const requestUrl = new URL(request.url());
    return (
      requestUrl.pathname === "/api/people" &&
      requestUrl.searchParams.get("query") === "Ana Beatriz"
    );
  });
  await page
    .getByRole("searchbox", { name: "Buscar colaboradores" })
    .fill("Ana Beatriz");
  await serverSearch;
  await expect(
    page.getByRole("status", {
      name: "Carregando diretório de colaboradores",
    }),
  ).toBeVisible();
  await expect(page.getByText("1–1 de 1 colaboradores")).toBeVisible();
  await expect(page.getByText("Página 1 de 1")).toBeVisible();
  await expect(
    table.getByText("Ana Beatriz Vasconcelos", { exact: true }),
  ).toBeVisible();
  await expectAccessiblePage(page, "/rh/colaboradores paginado", 1280);
});

test("direct routes and controls remain unavailable without their permissions", async ({
  page,
}) => {
  await login(page, accounts.noAccess, password);
  for (const endpoint of [
    "/api/people",
    "/api/birthdays",
    "/api/vacation-requests?scope=mine",
    "/api/admin/users",
    "/api/admin/roles",
    "/api/audit-events",
  ]) {
    const response = await page.request.get(endpoint);
    expect(response.status(), endpoint).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
  }
  for (const path of [
    "/rh",
    "/rh/colaboradores",
    "/rh/ferias",
    "/sistema/administracao",
    "/sistema/auditoria",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Nenhum módulo está disponível" }),
    ).toBeVisible();
  }

  await page.context().clearCookies();
  await login(page, accounts.viewer, password);
  await page.goto("/rh/ferias");
  await expect(page).toHaveURL("/");
  await page.goto("/sistema/administracao");
  await expect(page).toHaveURL("/");
  await page.goto("/rh/colaboradores");
  await expect(
    page.getByRole("button", { name: "Novo colaborador" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Importar CSV" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("columnheader", { name: "Ações" })).toHaveCount(
    0,
  );
});

test("backend rejects cross-unit writes and scoped platform permissions", async ({
  browser,
}) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, admin.email, admin.password);

  const [usersResponse, peopleResponse, unitsResponse] = await Promise.all([
    adminPage.request.get("/api/admin/users"),
    adminPage.request.get("/api/people?query=Caio%20Nascimento&pageSize=1"),
    adminPage.request.get("/api/admin/organization-units"),
  ]);
  expect(usersResponse.status()).toBe(200);
  expect(peopleResponse.status()).toBe(200);
  expect(unitsResponse.status()).toBe(200);
  const users = (await usersResponse.json()).users as Array<{
    id: string;
    email: string;
  }>;
  const people = (await peopleResponse.json()).people as Person[];
  const units = (await unitsResponse.json()).units as Array<{
    id: string;
    code: string;
  }>;
  const viewer = users.find((account) => account.email === accounts.viewer)!;
  const caio = people[0]!;
  const controlUnit = units.find((unit) => unit.code === "CCI")!;

  const scopedRoleResponse = await adminPage.request.post("/api/admin/roles", {
    data: {
      name: "Gestão de pessoas com escopo E2E",
      description: null,
      permissions: ["people.manage"],
    },
    headers: { origin: "http://127.0.0.1:4173" },
  });
  expect(scopedRoleResponse.status()).toBe(201);
  const scopedRole = (await scopedRoleResponse.json()) as { id: string };
  const scopedAssignment = await adminPage.request.post(
    "/api/admin/role-assignments",
    {
      data: {
        accountId: viewer.id,
        roleId: scopedRole.id,
        unitId: controlUnit.id,
      },
      headers: { origin: "http://127.0.0.1:4173" },
    },
  );
  expect(scopedAssignment.status()).toBe(201);

  const platformRoleResponse = await adminPage.request.post(
    "/api/admin/roles",
    {
      data: {
        name: "Contas da plataforma E2E",
        description: null,
        permissions: ["accounts.manage"],
      },
      headers: { origin: "http://127.0.0.1:4173" },
    },
  );
  expect(platformRoleResponse.status()).toBe(201);
  const platformRole = (await platformRoleResponse.json()) as { id: string };

  await adminPage.goto("/sistema/administracao");
  await adminPage
    .getByRole("button", { name: "Gerenciar acessos de Leonardo Araújo" })
    .click();
  await chooseOption(adminPage, "Adicionar perfil", "Contas da plataforma E2E");
  await expect(adminPage.getByLabel("Escopo do perfil")).toBeDisabled();
  await expect(
    adminPage.getByText("Este perfil exige escopo organizacional."),
  ).toBeVisible();
  await chooseOption(
    adminPage,
    "Adicionar perfil",
    "Gestão de pessoas com escopo E2E",
  );
  await expect(adminPage.getByLabel("Escopo do perfil")).toBeEnabled();
  await expectAccessiblePage(adminPage, "acessos da pessoa", 1280);

  const invalidAssignment = await adminPage.request.post(
    "/api/admin/role-assignments",
    {
      data: {
        accountId: viewer.id,
        roleId: platformRole.id,
        unitId: controlUnit.id,
      },
      headers: { origin: "http://127.0.0.1:4173" },
    },
  );
  expect(invalidAssignment.status()).toBe(400);
  expect(await invalidAssignment.json()).toMatchObject({
    code: "ROLE_REQUIRES_GLOBAL_SCOPE",
  });
  await adminContext.close();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, accounts.viewer, password);
  const crossUnitUpdate = await viewerPage.request.patch(
    `/api/people/${caio.id}`,
    {
      data: { employment: { unitId: controlUnit.id } },
      headers: { origin: "http://127.0.0.1:4173" },
    },
  );
  expect(crossUnitUpdate.status()).toBe(403);
  expect(await crossUnitUpdate.json()).toMatchObject({ code: "FORBIDDEN" });

  const forbiddenVacation = await viewerPage.request.post(
    "/api/vacation-requests",
    {
      data: {
        startDate: "2027-06-01",
        endDate: "2027-06-10",
        submit: false,
      },
      headers: { origin: "http://127.0.0.1:4173" },
    },
  );
  expect(forbiddenVacation.status()).toBe(403);
  await viewerContext.close();
});

test("individual access overrides and audit module work end to end", async ({
  browser,
  page,
}) => {
  await login(page, admin.email, admin.password);
  const [usersResponse, unitsResponse] = await Promise.all([
    page.request.get("/api/admin/users"),
    page.request.get("/api/admin/organization-units"),
  ]);
  const users = (await usersResponse.json()).users as Array<{
    id: string;
    email: string;
  }>;
  const units = (await unitsResponse.json()).units as Array<{
    id: string;
    code: string;
  }>;
  const noAccess = users.find(
    (account) => account.email === accounts.noAccess,
  )!;
  const viewer = users.find((account) => account.email === accounts.viewer)!;
  const controlUnit = units.find((unit) => unit.code === "CCI")!;

  await page.goto("/sistema/administracao");
  await page
    .getByRole("button", {
      name: "Gerenciar acessos de Ana Beatriz Vasconcelos",
    })
    .click();
  await chooseOption(
    page,
    "Permissão específica",
    "Pessoas e RH · Consultar pessoas",
  );
  await chooseOption(page, "Escopo do ajuste", "CCI · Controle Interno");
  await page.getByRole("button", { name: "Aplicar ajuste" }).click();
  await expect(page.getByText("Ajuste individual aplicado.")).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Acessos de Ana Beatriz Vasconcelos" })
      .getByText("Conceder", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page
    .getByRole("button", {
      name: "Gerenciar acessos de Leonardo Araújo",
    })
    .click();
  await chooseOption(
    page,
    "Permissão específica",
    "Pessoas e RH · Consultar pessoas",
  );
  await chooseOption(page, "Tratamento", "Bloquear acesso");
  await expect(page.getByLabel("Escopo do ajuste")).toBeDisabled();
  await page.getByRole("button", { name: "Aplicar ajuste" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Acessos de Leonardo Araújo" })
      .getByText("Bloquear", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  const allowedContext = await browser.newContext();
  const allowedPage = await allowedContext.newPage();
  await login(allowedPage, accounts.noAccess, password);
  const allowedResponse = await allowedPage.request.get("/api/people");
  expect(allowedResponse.status()).toBe(200);
  const allowedPeople = (await allowedResponse.json()).people as Person[];
  expect(allowedPeople.length).toBeGreaterThan(0);
  expect(
    allowedPeople.every(
      (person) => person.employment?.unitId === controlUnit.id,
    ),
  ).toBe(true);
  await allowedContext.close();

  const deniedContext = await browser.newContext();
  const deniedPage = await deniedContext.newPage();
  await login(deniedPage, accounts.viewer, password);
  const deniedResponse = await deniedPage.request.get("/api/people");
  expect(deniedResponse.status()).toBe(403);
  await deniedContext.close();

  await page.getByRole("link", { name: "Auditoria", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Auditoria" })).toBeVisible();
  await chooseOption(page, "Itens por página", "10");
  await expect(
    page.getByRole("button", { name: "Próxima página" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.getByText("Página 2 de", { exact: false })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Buscar nos registros" })
    .fill("permission-override.created");
  await expect(page.getByText("Página 1 de 1")).toBeVisible();
  await chooseOption(page, "Resultado", "Sucesso");
  await expect(
    page.getByText("Ajuste individual aplicado", { exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Ver detalhes de Ajuste individual aplicado",
    })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Ajuste individual aplicado" }),
  ).toContainText("permission-override.created");
  await page.getByRole("button", { name: "Fechar" }).click();
  await expectAccessiblePage(page, "/sistema/auditoria filtrada", 1280);

  const exportResponse = await page.request.get(
    "/api/audit-events/export?action=permission-override.created",
  );
  expect(exportResponse.status()).toBe(200);
  const exportCsv = await exportResponse.text();
  expect(exportCsv).toContain("actor_name");
  expect(exportCsv).toContain("permission-override.created");

  const overrideResponse = await page.request.get(
    "/api/admin/permission-overrides",
  );
  const overrides = (await overrideResponse.json()).overrides as Array<{
    id: string;
    accountId: string;
  }>;
  for (const override of overrides.filter((item) =>
    [noAccess.id, viewer.id].includes(item.accountId),
  )) {
    expect(
      (
        await page.request.delete(
          `/api/admin/permission-overrides/${override.id}`,
          { headers: { origin: "http://127.0.0.1:4173" } },
        )
      ).status(),
    ).toBe(204);
  }
});

test("supervisor and HR receive only their decision stages", async ({
  browser,
}) => {
  const supervisorContext = await browser.newContext();
  const supervisorPage = await supervisorContext.newPage();
  await login(supervisorPage, accounts.supervisor, password);
  await openHrRoute(supervisorPage, "Férias");
  await expect(
    supervisorPage.getByRole("heading", { name: "Decisões da chefia" }),
  ).toBeVisible();
  await expect(
    supervisorPage.getByRole("heading", { name: "Decisão final" }),
  ).toHaveCount(0);
  await expect(
    supervisorPage.getByRole("row", { name: /Caio Nascimento/ }),
  ).toBeVisible();
  await supervisorContext.close();

  const hrContext = await browser.newContext();
  const hrPage = await hrContext.newPage();
  await login(hrPage, accounts.hr, password);
  await openHrRoute(hrPage, "Férias");
  await expect(
    hrPage.getByRole("heading", { name: "Decisão final" }),
  ).toBeVisible();
  await expect(
    hrPage.getByRole("heading", { name: "Decisões da chefia" }),
  ).toHaveCount(0);
  await expect(
    hrPage.getByRole("row", { name: /Caio Nascimento/ }),
  ).toBeVisible();
  await expect(hrPage.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );
  await hrContext.close();
});

test("non-eligible and disabled accounts fail with actionable safe states", async ({
  page,
}) => {
  await login(page, accounts.contractor, password);
  await openHrRoute(page, "Férias");
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2027-02-01");
  await page.getByLabel("Data final").fill("2027-02-10");
  await page.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(
    page
      .getByRole("alert")
      .getByText(/categoria funcional não usa este fluxo/i),
  ).toBeVisible();

  await page.context().clearCookies();
  await login(page, accounts.disabled, password);
  await expect(
    page.getByRole("alert").getByText("E-mail ou senha inválidos."),
  ).toBeVisible();
});

test("first access exposes multiple modules and explains a missing supervisor", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(accounts.firstAccess);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: "Proteja sua conta" }),
  ).toBeVisible();
  await page.getByLabel("Senha temporária").fill(password);
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("Luiza-Final-Password-2026");
  await page
    .getByLabel("Confirme a nova senha")
    .fill("Luiza-Final-Password-2026");
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(
    page.getByText(/Entre novamente usando a nova senha/),
  ).toBeVisible();
  await login(page, accounts.firstAccess, "Luiza-Final-Password-2026");

  const navigation = page.getByRole("navigation", {
    name: "Navegação principal",
  });
  await expect(
    navigation.getByRole("link", { name: "Recursos Humanos", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Auditoria", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Administração", exact: true }),
  ).toHaveCount(0);

  await openHrRoute(page, "Férias");
  await expect(
    page.getByText("Você ainda não possui solicitações."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2028-02-01");
  await page.getByLabel("Data final").fill("2028-02-10");
  await page.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(
    page
      .getByRole("alert")
      .getByText(/chefia imediata ainda não foi cadastrada/i),
  ).toBeVisible();
});

test("empty, no-access, and inactive-employment personas give next steps", async ({
  page,
}) => {
  await login(page, accounts.emptyScope, password);
  await openHrRoute(page, "Colaboradores");
  await expect(
    page.getByRole("heading", { name: "Diretório vazio" }),
  ).toBeVisible();
  await expect(page.getByText(/unidades autorizadas/)).toBeVisible();

  await page.context().clearCookies();
  await login(page, accounts.noAccess, password);
  await expect(
    page.getByText("Nenhum módulo está disponível", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/administração da intranet/)).toBeVisible();

  await page.context().clearCookies();
  await login(page, accounts.inactiveEmployment, password);
  await openHrRoute(page, "Férias");
  await expect(
    page.getByRole("status").getByText(/não possui vínculo funcional ativo/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nova solicitação" }),
  ).toHaveCount(0);
});

test("malformed CSV keeps invalid imports from being applied", async ({
  page,
}) => {
  await login(page, accounts.hr, password);
  await openHrRoute(page, "Colaboradores");
  await page.getByRole("button", { name: "Importar CSV" }).click();
  await page.getByLabel("Arquivo CSV").setInputFiles({
    name: "colaboradores-invalidos.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
        "INVALIDO-001,,Pessoa inválida,31/02/2020,talvez,,SEM,,,ontem,sim",
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Validar arquivo" }).click();
  await expect(page.getByText(/Linha 2:/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aplicar 0 linhas válidas" }),
  ).toBeDisabled();
});

test("avatar upload normalizes images and respects unit scope", async ({
  browser,
  page,
}) => {
  await login(page, admin.email, admin.password);
  await openHrRoute(page, "Colaboradores");
  const personRow = page
    .getByRole("row")
    .filter({ hasText: "Caio Nascimento" });
  await personRow
    .getByRole("button", { name: "Gerenciar Caio Nascimento" })
    .click();

  const personAvatarPicker = page.getByLabel(
    "Selecionar nova foto de Caio Nascimento",
  );
  await personAvatarPicker.setInputFiles({
    name: "avatar-falso.png",
    mimeType: "image/png",
    buffer: Buffer.from("isto não é uma imagem"),
  });
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(
    page.getByRole("alert").getByText(/JPEG, PNG ou WebP válida/i),
  ).toBeVisible();

  await personAvatarPicker.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const avatarDialog = page.getByRole("dialog", {
    name: "Gerenciar Caio Nascimento",
  });
  await expect(avatarDialog.locator('[data-slot="avatar"] img')).toBeVisible();
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByText("Foto do colaborador atualizada.")).toBeVisible();
  const avatar = personRow.locator('[data-slot="avatar"] img');
  await expect(avatar).toBeVisible();
  const avatarUrl = await avatar.getAttribute("src");
  expect(avatarUrl).toMatch(/^\/api\/people\/.+\/avatar\?v=/);
  const stored = await page.request.get(avatarUrl!);
  expect(stored.status()).toBe(200);
  expect(stored.headers()["content-type"]).toContain("image/webp");

  const restrictedContext = await browser.newContext();
  const restrictedPage = await restrictedContext.newPage();
  await login(restrictedPage, accounts.viewer, password);
  expect((await restrictedPage.request.get(avatarUrl!)).status()).toBe(403);
  await restrictedContext.close();

  await avatarDialog.getByRole("button", { name: "Remover foto" }).click();
  await page
    .getByRole("alertdialog", { name: "Remover foto?" })
    .getByRole("button", { name: "Remover foto" })
    .click();
  await expect(page.getByText("Foto do colaborador removida.")).toBeVisible();
  await expect(personRow.locator('[data-slot="avatar"] img')).toHaveCount(0);

  const audit = await page.request.get("/api/audit-events/export");
  const auditText = await audit.text();
  expect(auditText).toContain("person.avatar-updated");
  expect(auditText).toContain("person.avatar-deleted");
});

test("stale vacation actions return an actionable concurrency state", async ({
  page,
}) => {
  await login(page, accounts.worker, password);
  await openHrRoute(page, "Férias");
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2028-06-01");
  await page.getByLabel("Data final").fill("2028-06-10");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Rascunho salvo/)).toBeVisible();

  const stalePage = await page.context().newPage();
  await stalePage.goto("/rh/ferias");
  const currentRow = page.getByRole("row").filter({ hasText: "01 de jun." });
  const staleRow = stalePage.getByRole("row").filter({ hasText: "01 de jun." });
  await expect(
    staleRow.getByRole("button", { name: "Enviar para chefia" }),
  ).toBeVisible();
  await currentRow.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(
    page.getByText(/Solicitação enviada para a chefia/),
  ).toBeVisible();
  await staleRow.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(
    stalePage
      .getByRole("alert")
      .getByText(/Atualize a página e tente novamente/i),
  ).toBeVisible();
  await stalePage.close();
});

test("administration onboards an employee and supports account operations", async ({
  page,
}) => {
  await login(page, admin.email, admin.password);
  await expect(
    page.getByRole("link", { name: "Solicitar férias" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Administração", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Contas de acesso" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Novo acesso" }).click();
  await expect(
    page.getByRole("button", { name: "Novo colaborador" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectAccessiblePage(page, "novo acesso", 1280);
  await page.getByLabel("Nome completo").fill("Íris Fernandes E2E");
  await page.getByLabel("Nome social ou preferido").fill("Íris");
  await page.getByLabel("Data de nascimento").fill("1992-04-17");
  await page.getByLabel("Matrícula").fill("ADM-E2E-001");
  await page.getByLabel("Data de início").fill("2026-07-28");
  await chooseFirstOption(page, "Categoria funcional");
  await chooseFirstOption(page, "Unidade de lotação");
  await page.getByLabel("Cargo").fill("Analista de controle");
  await page
    .getByLabel("E-mail institucional")
    .fill("account-audit-e2e@local.invalid");
  await page
    .getByLabel("Senha temporária")
    .fill("Account-Audit-E2E-Password-123");
  await page
    .getByRole("button", {
      name: "Cadastrar colaborador e criar acesso",
    })
    .click();
  await expect(
    page.getByText("Colaborador e conta de acesso criados."),
  ).toBeVisible();
  await expect(page.getByText("Íris", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: /^Perfis/ }).click();
  await page
    .getByRole("button", {
      name: "Editar perfil Colaborador Homologação",
    })
    .click();
  const roleDialog = page.getByRole("dialog", {
    name: "Editar perfil de acesso",
  });
  for (const module of [
    "Administração do sistema",
    "Auditoria",
    "Pessoas e RH",
    "Férias",
  ]) {
    await expect(
      roleDialog.getByRole("heading", { name: module }),
    ).toBeVisible();
  }
  await roleDialog
    .getByRole("button", {
      name: "Explicar permissão Administrar pessoas",
    })
    .focus();
  await expect(
    page
      .getByRole("tooltip")
      .getByText(/pessoas, vínculos, chefias e lotações/i),
  ).toBeVisible();
  await expectAccessiblePage(page, "explicação de permissão", 1280);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectAccessiblePage(page, "permissões em tela estreita", 390);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .getByLabel("Descrição")
    .fill("Acesso de colaborador validado em homologação.");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Perfil atualizado.")).toBeVisible();

  await page.getByRole("link", { name: /Pessoas e acessos/ }).click();
  const workerRow = page
    .getByRole("row")
    .filter({ hasText: "account-audit-e2e@local.invalid" });
  await workerRow
    .getByRole("button", { name: /Redefinir senha de Íris/i })
    .click();
  await page
    .getByLabel("Nova senha temporária")
    .fill("Account-Audit-Reset-Password-456");
  await page.getByRole("button", { name: "Redefinir senha" }).click();
  await expect(page.getByText(/sessões revogadas/)).toBeVisible();

  await openHrRoute(page, "Colaboradores");
  await page
    .getByRole("searchbox", { name: "Buscar colaboradores" })
    .fill("Íris Fernandes");
  const irisRow = page.getByRole("row").filter({ hasText: "Íris Fernandes" });
  await irisRow.getByRole("button", { name: "Gerenciar Íris" }).click();
  const personDialog = page.getByRole("dialog", {
    name: "Gerenciar Íris",
  });
  const deactivateIris = personDialog.getByRole("button", {
    name: "Desativar vínculo e acesso",
  });
  await deactivateIris.click();
  const deactivateDialog = page.getByRole("alertdialog", {
    name: "Desativar colaborador?",
  });
  await expect(deactivateDialog).toContainText(
    "O vínculo e a conta de Íris serão desativados.",
  );
  await deactivateDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(deactivateDialog).toHaveCount(0);
  await deactivateIris.click();
  await page
    .getByRole("alertdialog", { name: "Desativar colaborador?" })
    .getByRole("button", { name: "Desativar colaborador" })
    .click();
  await expect(page.getByText("Vínculo e conta desativados.")).toBeVisible();

  const audit = await page.request.get("/api/audit-events/export");
  expect(audit.ok()).toBeTruthy();
  expect(audit.headers()["content-type"]).toContain("text/csv");
  const auditText = await audit.text();
  expect(auditText).toContain("person.created");
  expect(auditText).toContain("account.created");
  expect(auditText).toContain("role.updated");
  expect(auditText).toContain("person.deactivated");

  await page.getByRole("button", { name: "Recolher barra lateral" }).click();
  await expect(
    page.getByRole("button", { name: "Expandir barra lateral" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expandir barra lateral" }).click();
  await expect(
    page.getByRole("button", { name: "Recolher barra lateral" }),
  ).toBeVisible();
});

test("mobile navigation traps focus, closes with Escape, and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, accounts.worker, password);
  const trigger = page.getByRole("button", { name: "Abrir menu" });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Navegação principal" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test("desktop collapse control remains fully visible and interactive", async ({
  page,
}) => {
  await login(page, accounts.worker, password);
  await expect(page.getByRole("banner")).toBeHidden();
  expect(
    await page.getByRole("main").evaluate((main) => {
      return main.getBoundingClientRect().top;
    }),
  ).toBeLessThan(40);
  const control = page.getByRole("button", {
    name: "Recolher barra lateral",
  });
  await expect(control).toBeVisible();
  expect(
    await control.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return [0.2, 0.5, 0.8].map((position) => {
        const target = document.elementFromPoint(
          bounds.left + bounds.width * position,
          bounds.top + bounds.height / 2,
        );
        return target === button || button.contains(target);
      });
    }),
  ).toEqual([true, true, true]);
});

test("critical pages pass WCAG AA automation at mobile, tablet, and desktop sizes", async ({
  page,
}) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta" }),
    ).toBeVisible();
    await expectAccessiblePage(page, "/login", viewport.width);
  }

  await login(page, admin.email, admin.password);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/",
      "/rh",
      "/rh/colaboradores",
      "/rh/ferias",
      "/sistema/administracao",
      "/sistema/administracao?secao=access",
      "/sistema/auditoria",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expectAccessiblePage(page, path, viewport.width);
    }
  }
});

async function expectAccessiblePage(page: Page, path: string, width: number) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `${path} at ${width}px: ${results.violations
      .map((item) => `${item.id} (${item.nodes.length})`)
      .join(", ")}`,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function login(page: Page, email: string, loginPassword: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(loginPassword);
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  if (email !== accounts.disabled) {
    await expect(page.getByRole("heading", { name: /^Olá,/ })).toBeVisible();
  }
}

async function openHrRoute(page: Page, route: "Colaboradores" | "Férias") {
  await page
    .getByRole("link", { name: "Recursos Humanos", exact: true })
    .click();
  await page.getByRole("link", { name: route, exact: true }).click();
}

async function chooseOption(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field, exact: true }).click();
  const search = page.getByRole("combobox", { name: "Pesquisar opções" });
  if (await search.isVisible()) await search.fill(option);
  await page
    .getByRole("option", { name: new RegExp(`^${option}(?: ·|$)`) })
    .click();
}

async function chooseFirstOption(page: Page, field: string) {
  await page.getByRole("combobox", { name: field, exact: true }).click();
  await page.getByRole("option").first().click();
}
