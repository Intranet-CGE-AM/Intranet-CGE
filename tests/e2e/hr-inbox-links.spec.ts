import { expect, test } from "./fixtures";

test("atalhos preservam a fila de análise de capacitações e ocorrências", async ({
  page,
}) => {
  await page.request.post("/api/auth/login", {
    data: {
      email: "admin-e2e@local.invalid",
      password: "Admin-E2E-Password-123",
    },
  });
  await page.goto("/rh/capacitacoes?scope=review");
  await expect(
    page.getByRole("button", { name: "Analisar capacitações", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/rh/ocorrencias?scope=final");
  await expect(
    page.getByRole("button", { name: "Análise do RH", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/rh/ocorrencias?scope=supervisor");
  await expect(
    page.getByRole("button", { name: "Equipe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
