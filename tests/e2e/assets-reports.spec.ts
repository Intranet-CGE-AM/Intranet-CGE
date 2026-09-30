import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chooseOption, expect, test } from "./fixtures";

// xlsx is a dependency of the web app only.
const XLSX = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
)("xlsx") as typeof import("xlsx");

test.use({ actionTimeout: 15000 });

async function seed(page: import("@playwright/test").Page) {
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
  const tag = Date.now().toString(36).toUpperCase();
  const unit = async (
    type: string,
    name: string,
    parentId: string | null = null,
  ) => {
    const response = await page.request.post("/api/organization-units", {
      data: {
        code: `${type.slice(0, 3).toUpperCase()}${tag}`,
        name,
        type,
        parentId,
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: string; code: string };
  };
  const department = await unit("department", `Departamento ${tag}`);
  const sector = await unit("sector", `Setor ${tag}`, department.id);
  const subsector = await unit("subsector", `Subsetor ${tag}`, sector.id);
  const asset = async (
    suffix: string,
    unitId: string,
    conservationStatus: string | null,
    acquisitionValue: number,
  ) => {
    const response = await page.request.post("/api/assets", {
      data: {
        patrimonyNumber: `REL-${tag}-${suffix}`,
        description: `Bem ${suffix} ${tag}`,
        unitId,
        conservationStatus,
        acquisitionValue,
      },
    });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: string };
  };
  await asset("1", sector.id, "Bom", 1000);
  const second = await asset("2", subsector.id, "Ruim", 500);
  await asset("3", sector.id, null, 200);
  expect(
    (
      await page.request.patch(`/api/assets/${second.id}/status`, {
        data: { status: "maintenance" },
      })
    ).status(),
  ).toBe(200);
  return { tag, department, sector };
}

async function generate(
  page: import("@playwright/test").Page,
  departmentName: string,
  type?: string,
) {
  await page.goto("/patrimonio/relatorios");
  await chooseOption(page, "Departamento", new RegExp(departmentName));
  if (type) await chooseOption(page, "Tipo de relatório", type);
  await page.getByRole("button", { name: "Gerar relatório" }).click();
}

test("tipo de relatório muda o resultado exibido", async ({ page }) => {
  const { tag, sector } = await seed(page);
  const dept = `Departamento ${tag}`;
  const sectorRow = page.getByRole("row", { name: new RegExp(sector.code) });

  await generate(page, dept, "Bens por setor");
  // The subsector asset rolls up into its parent sector: 3 assets, R$ 1.700,00.
  await expect(sectorRow).toContainText("3");
  await expect(sectorRow).toContainText("1.700,00");
  await expect(
    page.getByRole("columnheader", { name: "Quantidade" }),
  ).toBeVisible();

  await chooseOption(page, "Tipo de relatório", "Bens por situação");
  await expect(page.getByText("bens patrimoniais")).toHaveCount(3);
  await expect(page.getByText("Em manutenção", { exact: true })).toBeVisible();
  await expect(page.getByText("Baixado", { exact: true })).toBeVisible();

  await chooseOption(page, "Tipo de relatório", "Estado de conservação");
  for (const [label, total] of [
    ["Bom", "1"],
    ["Ruim", "1"],
    ["Não informado", "1"],
  ] as const) {
    await expect(
      page.getByRole("row", { name: `${label} ${total}` }),
    ).toBeVisible();
  }

  await chooseOption(page, "Tipo de relatório", "Relatório financeiro");
  await expect(page.getByText("Bens considerados")).toBeVisible();
  await expect(page.getByText("Valor médio")).toBeVisible();
  await expect(page.getByText("R$ 566,67")).toBeVisible();

  await chooseOption(page, "Tipo de relatório", "Movimentações");
  await expect(
    page.getByText("O relatório de movimentações será carregado"),
  ).toBeVisible();

  await chooseOption(page, "Tipo de relatório", "Inventário geral");
  await expect(page.getByRole("cell", { name: `REL-${tag}-1` })).toBeVisible();
});

test("exportações registram os filtros aplicados", async ({ page }) => {
  const { tag } = await seed(page);
  await generate(page, `Departamento ${tag}`);
  await chooseOption(page, "Situação", "Em manutenção");
  await page.getByRole("button", { name: "Gerar relatório" }).click();
  await expect(page.getByText(`REL-${tag}-2`)).toBeVisible();
  await expect(page.getByText(`REL-${tag}-1`)).toHaveCount(0);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const pdf = readFileSync((await (await pdfDownload).path())!).toString(
    "latin1",
  );
  expect(pdf).toContain(`Departamento: Departamento ${tag}`);
  expect(pdf).toContain("Situação: Em manutenção");

  const xlsDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar XLSX" }).click();
  const workbook = XLSX.read(readFileSync((await (await xlsDownload).path())!));
  const summary = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets["Resumo"]!,
  );
  const info = Object.fromEntries(
    summary.map((row) => [row["Informação"], row["Valor"]]),
  );
  expect(info["Tipo de relatório"]).toBe("Inventário geral");
  expect(String(info["Departamento"])).toContain(`Departamento ${tag}`);
  expect(info["Situação"]).toBe("Em manutenção");
  expect(info["Quantidade de bens"]).toBe(1);
});
