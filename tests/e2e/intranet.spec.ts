import { expect, test, type Page } from "@playwright/test";

const admin = {
  email: "admin-e2e@local.invalid",
  password: "Admin-E2E-Password-123",
};
const supervisor = {
  email: "supervisor-e2e@local.invalid",
  temporaryPassword: "Supervisor-Temp-Password-123",
  password: "Supervisor-Final-Password-123",
};
const worker = {
  email: "worker-e2e@local.invalid",
  temporaryPassword: "Worker-Temp-Password-123",
  password: "Worker-Final-Password-123",
};

test("complete HR journey from import through final vacation approval", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();

  await login(page, "invalid@local.invalid", "invalid-password");
  await expect(
    page.getByRole("alert").getByText("E-mail ou senha inválidos."),
  ).toBeVisible();

  await page.getByLabel("E-mail institucional").fill(admin.email);
  await page.getByLabel("Senha").fill(admin.password);
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await expect(
    page.getByRole("heading", { name: /Olá, Administrador/ }),
  ).toBeVisible();

  await openHrRoute(page, "Colaboradores");
  await page.getByRole("button", { name: "Categorias e unidades" }).click();
  await page.locator("#categoryName").fill("Servidor efetivo E2E");
  await page.getByLabel("Pode solicitar férias por este fluxo").check();
  await page.getByRole("button", { name: "Cadastrar categoria" }).click();
  await expect(
    page.getByRole("dialog").getByText(/Servidor efetivo E2E/),
  ).toBeVisible();
  await page.locator("#unitCode").fill("E2ETI");
  await page.locator("#unitName").fill("Tecnologia E2E");
  await page.getByRole("button", { name: "Cadastrar unidade" }).click();
  await expect(page.getByRole("dialog").getByText(/E2ETI/)).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await page.getByRole("button", { name: "Importar CSV" }).click();
  await expect(
    page.getByRole("link", { name: "Baixar modelo CSV" }),
  ).toHaveAttribute("download", "");
  await page.getByLabel("Arquivo CSV").setInputFiles({
    name: "pessoas-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
        "E2E-001,Supervisora E2E,Supervisora,1985-02-10,sim,Servidor efetivo E2E,E2ETI,Tecnologia E2E,Gerente,2020-01-02,sim",
        "E2E-002,Trabalhador E2E,Trabalhador,1990-08-15,sim,Servidor efetivo E2E,E2ETI,Tecnologia E2E,Analista,2021-03-04,sim",
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Validar arquivo" }).click();
  await expect(page.getByText(/2 válidas · 0 com erro/)).toBeVisible();
  await page.getByRole("button", { name: "Aplicar 2 linhas válidas" }).click();
  await page.getByRole("button", { name: "Fechar" }).click();
  await page
    .getByRole("searchbox", { name: "Buscar colaboradores" })
    .fill("Trabalhador");
  await expect(page.getByText("Trabalhador", { exact: true })).toBeVisible();

  const workerRow = page.getByRole("row", { name: /Trabalhador E2E/ });
  await workerRow.getByRole("button", { name: "Definir chefia" }).click();
  await chooseOption(page, "Chefia direta", "Supervisora");
  await page.getByRole("button", { name: "Salvar chefia" }).click();

  await page.getByRole("link", { name: "Administração" }).click();
  await createAccount(
    page,
    "Supervisora",
    supervisor.email,
    supervisor.temporaryPassword,
  );
  await createAccount(
    page,
    "Trabalhador",
    worker.email,
    worker.temporaryPassword,
  );
  await createRole(page, "Chefia E2E", "Decisão da chefia");
  await createRole(page, "Colaborador E2E", "Solicitar férias");
  await assignRole(page, "Supervisora", "Chefia E2E", "E2ETI · Tecnologia E2E");
  await assignRole(
    page,
    "Trabalhador",
    "Colaborador E2E",
    "E2ETI · Tecnologia E2E",
  );

  await logout(page, "Administrador da Plataforma");
  await firstLogin(page, worker, "Trabalhador");
  await openHrRoute(page, "Férias");
  await page.getByRole("button", { name: "Nova solicitação" }).click();
  await page.getByLabel("Data inicial").fill("2026-09-01");
  await page.getByLabel("Data final").fill("2026-09-15");
  await page.getByRole("button", { name: "Enviar para chefia" }).click();
  await expect(page.getByText("Aguardando chefia")).toBeVisible();

  await logout(page, "Trabalhador");
  await firstLogin(page, supervisor, "Supervisora");
  await openHrRoute(page, "Férias");
  const supervisorQueue = page.getByRole("heading", {
    name: "Decisões da chefia",
  });
  await expect(supervisorQueue).toBeVisible();
  await page
    .getByRole("row", { name: /Trabalhador.*Analisar/ })
    .getByRole("button", { name: "Analisar" })
    .click();
  await expect(page.getByLabel("Decisão", { exact: true })).toHaveText(
    "Selecione uma decisão",
  );
  await chooseOption(page, "Decisão", "Aprovar");
  await page.getByLabel("Comentário").fill("Período validado pela chefia.");
  await page.getByRole("button", { name: "Confirmar decisão" }).click();
  await expect(
    page.getByText("Nenhuma solicitação aguarda decisão da chefia."),
  ).toBeVisible();

  await logout(page, "Supervisora");
  await login(page, admin.email, admin.password);
  await openHrRoute(page, "Férias");
  const finalRow = page.getByRole("row", { name: /Trabalhador.*Analisar/ });
  await finalRow.getByRole("button", { name: "Analisar" }).click();
  await chooseOption(page, "Decisão", "Aprovar");
  await page
    .getByLabel("Comentário")
    .fill("Elegibilidade conferida pela área de RH.");
  await page.getByRole("button", { name: "Confirmar decisão" }).click();
  await expect(
    page.getByText("Decisão registrada no histórico."),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /Trabalhador.*Analisar/ }),
  ).toHaveCount(0);

  const audit = await page.request.get("/api/audit-events/export");
  expect(audit.ok()).toBeTruthy();
  const auditCsv = await audit.text();
  expect(auditCsv).toContain("people-import.apply");
  expect(auditCsv).toContain("vacation.submitted");
  expect(auditCsv).toContain("vacation.supervisor-approve");
  expect(auditCsv).toContain("vacation.final-approve");
});

test("login remains usable with keyboard on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByText("CGE Amazonas")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail institucional")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Senha")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Entrar na intranet" }),
  ).toBeFocused();
});

test("login rate limit is isolated by account identifier", async ({
  request,
}) => {
  const attempts = [];
  for (let index = 0; index < 6; index += 1) {
    attempts.push(
      await request.post("/api/auth/login", {
        headers: { Origin: "http://127.0.0.1:4173" },
        data: {
          email: "rate-limit-e2e@local.invalid",
          password: "invalid-password",
        },
      }),
    );
  }
  expect(
    attempts.slice(0, 5).every((response) => response.status() === 401),
  ).toBeTruthy();
  expect(attempts[5]?.status()).toBe(429);
});

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
}

async function openHrRoute(page: Page, route: "Colaboradores" | "Férias") {
  await page
    .getByRole("link", { name: "Recursos Humanos", exact: true })
    .click();
  await page.getByRole("link", { name: route, exact: true }).click();
}

async function firstLogin(
  page: Page,
  account: {
    email: string;
    temporaryPassword: string;
    password: string;
  },
  expectedName: string,
) {
  await login(page, account.email, account.temporaryPassword);
  await expect(
    page.getByRole("heading", { name: "Proteja sua conta" }),
  ).toBeVisible();
  await page.getByLabel("Senha temporária").fill(account.temporaryPassword);
  await page.getByLabel("Nova senha", { exact: true }).fill(account.password);
  await page.getByLabel("Confirme a nova senha").fill(account.password);
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Entre novamente usando a nova senha."),
  ).toBeVisible();
  await login(page, account.email, account.password);
  await expect(
    page.getByRole("button", {
      name: new RegExp(`Abrir menu da conta de ${expectedName}`, "i"),
    }),
  ).toBeVisible();
}

async function logout(page: Page, displayName: string) {
  await page
    .getByRole("button", {
      name: new RegExp(`Abrir menu da conta de ${displayName}`, "i"),
    })
    .click();
  await page.getByRole("menuitem", { name: "Sair da intranet" }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo de volta" }),
  ).toBeVisible();
}

async function createAccount(
  page: Page,
  person: string,
  email: string,
  password: string,
) {
  await page.getByRole("button", { name: "Novo acesso" }).click();
  await page.getByRole("button", { name: "Pessoa já cadastrada" }).click();
  await chooseOption(page, "Pessoa", person);
  await page.getByLabel("E-mail institucional").fill(email);
  await page.getByLabel("Senha temporária").fill(password);
  await page.getByRole("button", { name: "Criar conta de acesso" }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
}

async function createRole(page: Page, name: string, permission: string) {
  await page.getByRole("link", { name: /^Perfis/ }).click();
  await page.getByRole("button", { name: "Novo perfil" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("checkbox", { name: permission, exact: true }).check();
  await page.getByRole("button", { name: "Criar perfil" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function assignRole(
  page: Page,
  account: string,
  role: string,
  unitLabel: string,
) {
  await page.getByRole("link", { name: /Pessoas e acessos/ }).click();
  await page
    .getByRole("button", { name: `Gerenciar acessos de ${account}` })
    .click();
  const dialog = page.getByRole("dialog", {
    name: `Acessos de ${account}`,
  });
  await chooseOption(page, "Adicionar perfil", role);
  await chooseOption(page, "Escopo do perfil", unitLabel);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(dialog.locator("p").filter({ hasText: role })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
}

async function chooseOption(page: Page, field: string, option: string) {
  await page.getByRole("combobox", { name: field, exact: true }).click();
  const search = page.getByRole("combobox", { name: "Pesquisar opções" });
  if (await search.isVisible()) await search.fill(option);
  await page.getByRole("option", { name: option, exact: true }).click();
}
