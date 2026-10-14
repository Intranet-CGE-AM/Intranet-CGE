import { clientHeaders } from "./fixtures";
import { expect, test } from "./fixtures";

test("importação registra origem e repetição não apaga alteração manual", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:4173",
    extraHTTPHeaders: { ...clientHeaders(), Origin: "http://127.0.0.1:4173" },
  });
  try {
    await api.post("/api/auth/login", {
      data: {
        email: "admin-e2e@local.invalid",
        password: "Admin-E2E-Password-123",
      },
    });
    const number = `PROV-${Date.now()}`;
    const csv = [
      "matricula,nome,nome_preferido,data_nascimento,aniversario_visivel,categoria,unidade_codigo,unidade_nome,cargo,data_inicio,ativo",
      `${number},Proveniência E2E,,,nao,Efetivo Proveniência,PROV,Unidade Proveniência,Analista importado,2020-01-01,sim`,
    ].join("\n");
    const imported = await api.post("/api/imports/people", {
      data: { filename: "origem-e2e.csv", csv, mode: "apply" },
    });
    expect(imported.status()).toBe(200);
    const run = await imported.json();
    expect(run.successfulRows).toBe(1);
    const {
      people: [person],
    } = await (await api.get(`/api/people?query=${number}`)).json();
    const initial = await (
      await api.get(`/api/people/${person.id}/employment-history`)
    ).json();
    expect(initial.movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "admission",
          source: "import",
          importRunId: run.importRunId,
          checksum: run.checksum,
        }),
      ]),
    );
    expect(
      (
        await api.post(`/api/people/${person.id}/movements`, {
          data: {
            expectedVersion: initial.version,
            effectiveOn: "2026-09-07",
            reason: "Retificação conferida pelo RH",
            changes: { jobTitle: "Analista corrigido" },
          },
        })
      ).status(),
    ).toBe(201);
    const changed = await (
      await api.get(`/api/people/${person.id}/employment-history`)
    ).json();
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(
        (
          await api.post("/api/imports/people", {
            data: { filename: "origem-e2e.csv", csv, mode: "apply" },
          })
        ).status(),
      ).toBe(200);
    }
    const final = await (
      await api.get(`/api/people/${person.id}/employment-history`)
    ).json();
    expect(final.movements).toHaveLength(changed.movements.length);
    expect(final.employments[0].jobTitle).toBe("Analista corrigido");
    expect(
      final.provenance.find(
        (item: { field: string }) => item.field === "employment.jobTitle",
      ).updatedAt,
    ).toBe(
      changed.provenance.find(
        (item: { field: string }) => item.field === "employment.jobTitle",
      ).updatedAt,
    );
    expect(final.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "employment.jobTitle",
          source: "manual",
          value: "Analista corrigido",
          externalValue: "Analista importado",
        }),
      ]),
    );
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Manaus",
    });
    const metricsUrl = `/api/hr-metrics?startDate=${today}&endDate=${today}&unitId=${final.employments[0].unitId}`;
    expect((await (await api.get(metricsUrl)).json()).divergences).toBe(1);
    const preview = await (
      await api.post("/api/imports/people", {
        data: { filename: "origem-e2e.csv", csv, mode: "preview" },
      })
    ).json();
    expect(preview.rows[0].comparisons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "employment.jobTitle",
          localValue: "Analista corrigido",
          importedValue: "Analista importado",
          source: "manual",
          state: "divergent",
        }),
      ]),
    );
    const reconciled = await (
      await api.post("/api/imports/people", {
        data: {
          filename: "origem-e2e.csv",
          csv,
          mode: "apply",
          reconciliation: {
            previewId: preview.importRunId,
            fields: [{ employeeNumber: number, field: "employment.jobTitle" }],
          },
        },
      })
    ).json();
    expect(reconciled.successfulRows).toBe(1);
    expect((await (await api.get(metricsUrl)).json()).divergences).toBe(0);
    const reconciledHistory = await (
      await api.get(`/api/people/${person.id}/employment-history`)
    ).json();
    expect(reconciledHistory.employments[0].jobTitle).toBe(
      "Analista importado",
    );
    expect(reconciledHistory.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "employment.jobTitle",
          source: "import",
          value: "Analista importado",
        }),
      ]),
    );
    const repeated = await (
      await api.post("/api/imports/people", {
        data: {
          filename: "origem-e2e.csv",
          csv,
          mode: "apply",
          reconciliation: {
            previewId: preview.importRunId,
            fields: [{ employeeNumber: number, field: "employment.jobTitle" }],
          },
        },
      })
    ).json();
    expect(repeated.failedRows).toBe(1);
    expect(repeated.rows[0].errors[0].message).toContain(
      "cadastro mudou após a prévia",
    );
    expect(
      (
        await (
          await api.get(`/api/people/${person.id}/employment-history`)
        ).json()
      ).movements,
    ).toHaveLength(reconciledHistory.movements.length);
    expect(
      (
        await api.post("/api/imports/people", {
          data: {
            filename: "outro.csv",
            csv: csv.replace("Analista importado", "Outro cargo"),
            mode: "apply",
            reconciliation: {
              previewId: preview.importRunId,
              fields: [
                { employeeNumber: number, field: "employment.jobTitle" },
              ],
            },
          },
        })
      ).status(),
    ).toBe(409);
  } finally {
    await api.dispose();
  }
});
