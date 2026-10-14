import { test, expect } from "@playwright/test";
test("administrator links a person without email, then the AD user signs in and sees corporate password guidance", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page
    .getByLabel("E-mail institucional ou usuário AD")
    .fill("admin@local.invalid");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Browser-Local-Password-123");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo acesso AD", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Pessoa cadastrada", exact: true })
    .click();
  await page.getByRole("option", { name: /Pessoa piloto AD/ }).click();
  await page.getByLabel("Usuário do AD", { exact: true }).fill("pilot");
  await page.getByRole("button", { name: "Consultar AD", exact: true }).click();
  await expect(
    page.getByText("Sem e-mail cadastrado", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar vínculo com AD", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("row", { name: /Pessoa piloto AD/ });
  await expect(
    row.getByText("Active Directory", { exact: true }),
  ).toBeVisible();
  await expect(
    row.getByRole("button", { name: /Redefinir senha/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Abrir menu da conta/ }).click();
  await page.getByRole("menuitem", { name: "Sair da intranet" }).click();
  await page.getByLabel("E-mail institucional ou usuário AD").fill("pilot");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Browser-AD-Password-123");
  await page.getByRole("button", { name: "Entrar na intranet" }).click();
  await page.getByRole("button", { name: /Abrir menu da conta/ }).click();
  await page.getByRole("menuitem", { name: "Minha conta" }).click();
  await expect(
    page.getByText(/Sua senha é gerenciada pelo Active Directory/),
  ).toBeVisible();
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  const response = await page.request.get("/api/auth/me");
  expect((await response.json()).user.account).toMatchObject({
    authProvider: "ad",
    email: null,
    directoryUsername: "pilot@cge.lan",
  });
});
