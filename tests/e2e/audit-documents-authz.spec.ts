import type { APIRequestContext } from "@playwright/test";

import {
  auditRows,
  dedicatedUnit,
  detail,
  freshAccount,
  overrides,
  signInAll,
  transition,
  unique,
} from "./audit-document-api";
import {
  auditTeams,
  createDocument,
  docxFile,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { clientHeaders, expect, test } from "./fixtures";

async function create(
  client: APIRequestContext,
  unit: string,
  title = "Documento de autorização E2E",
) {
  const response = await createDocument(
    client,
    { unitId: unit, title: unique(title) },
    docxFile(),
  );
  expect(response.status()).toBe(201);
  const document = (await response.json()) as {
    id: string;
    files: { id: string }[];
  };
  return { id: document.id, fileId: document.files[0]!.id };
}

const listIds = async (client: APIRequestContext, query = "") => {
  const response = await client.get(`/api/audit-documents${query}`);
  expect(response.status()).toBe(200);
  return ((await response.json()).documents as { id: string }[]).map(
    (item) => item.id,
  );
};

const visibleUnitNames = async (client: APIRequestContext) => {
  const response = await client.get("/api/audit-documents/options");
  expect(response.status()).toBe(200);
  return ((await response.json()).visibleUnits as { name: string }[]).map(
    (unit) => unit.name,
  );
};

test("sem sessão, todas as rotas do módulo respondem 401", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator] = await signInAll(playwright, baseURL!, "coordinatorA");
  const anonymous = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { ...clientHeaders(), Origin: baseURL! },
  });
  try {
    const teamA = await unitId(coordinator!, auditTeams.a);
    const { id, fileId } = await create(coordinator!, teamA);
    const responses = [
      await anonymous.get("/api/audit-documents"),
      await anonymous.get("/api/audit-documents/options"),
      await anonymous.get("/api/audit-documents/settings"),
      await anonymous.put("/api/audit-documents/settings", {
        data: { bottleneckRounds: 3 },
      }),
      await anonymous.get(
        `/api/audit-documents/metrics?from=2003-03-10&to=2003-03-10`,
      ),
      await anonymous.get(`/api/audit-documents/${id}`),
      await anonymous.get(`/api/audit-documents/${id}/files/${fileId}`),
      await createDocument(
        anonymous,
        { unitId: teamA, title: "Envio sem sessão" },
        docxFile(),
      ),
      await uploadVersion(anonymous, id, { version: 1 }, docxFile()),
      await transition(anonymous, id, {
        action: "cancel",
        version: 1,
        message: "Sem sessão.",
      }),
    ];
    expect(responses.map((response) => response.status())).toEqual(
      responses.map(() => 401),
    );
    // Nada mudou no documento.
    expect(await detail(coordinator!, id)).toMatchObject({
      status: "in_review",
      version: 1,
      fileCount: 1,
    });
  } finally {
    await Promise.all([coordinator!.dispose(), anonymous.dispose()]);
  }
});

test("conta sem permissões recebe 403 nas coleções e 404 nos documentos", async ({
  playwright,
  baseURL,
}) => {
  const [noAccess, coordinator, admin] = await signInAll(
    playwright,
    baseURL!,
    "noAccess",
    "coordinatorA",
    "admin",
  );
  try {
    const teamA = await unitId(coordinator!, auditTeams.a);
    const { id, fileId } = await create(coordinator!, teamA);
    for (const response of [
      await noAccess!.get(
        "/api/audit-documents/metrics?from=2003-03-10&to=2003-03-10",
      ),
      await createDocument(
        noAccess!,
        { unitId: teamA, title: "Envio sem permissão" },
        docxFile(),
      ),
    ])
      expect(response.status()).toBe(403);
    // Documento existente fora do escopo: 404 (Q1: escopo antes da chave).
    for (const response of [
      await noAccess!.get(`/api/audit-documents/${id}`),
      await noAccess!.get(`/api/audit-documents/${id}/files/${fileId}`),
      await transition(noAccess!, id, {
        action: "cancel",
        version: 1,
        message: "Sem permissão.",
      }),
      await uploadVersion(noAccess!, id, { version: 1 }, docxFile()),
    ])
      expect(response.status()).toBe(404);
    const denied = await auditRows(admin!, id, { outcome: "denied" });
    expect(denied.map((row) => row.action)).toEqual(
      Array(4).fill("audit-document.access-denied"),
    );
  } finally {
    await Promise.all([noAccess, coordinator, admin].map((c) => c!.dispose()));
  }
});

test("só leitura na equipe consulta e baixa, mas não envia nem cancela", async ({
  playwright,
  baseURL,
}) => {
  const [admin] = await signInAll(playwright, baseURL!, "admin");
  const grants = overrides(admin!);
  let reader: APIRequestContext | undefined;
  try {
    const unit = await dedicatedUnit(admin!, "Equipe só leitura E2E");
    const account = await freshAccount(playwright, baseURL!, admin!, unit.id);
    reader = account.client;
    await grants.add(account.id, "audit_documents.read", unit.id);
    const { id, fileId } = await create(admin!, unit.id);

    expect(await listIds(reader)).toContain(id);
    const opened = await detail(reader, id);
    expect(opened.allowedActions).toEqual([]);
    expect(
      (await reader.get(`/api/audit-documents/${id}/files/${fileId}`)).status(),
    ).toBe(200);
    const options = await (
      await reader.get("/api/audit-documents/options")
    ).json();
    expect(options.units).toEqual([]);
    expect(options.visibleUnits).toEqual([{ id: unit.id, name: unit.name }]);
    for (const response of [
      await createDocument(
        reader,
        { unitId: unit.id, title: "Envio de leitor" },
        docxFile(),
      ),
      await transition(reader, id, {
        action: "cancel",
        version: 1,
        message: "Leitor cancelando.",
      }),
      await uploadVersion(reader, id, { version: 1 }, docxFile()),
    ])
      expect(response.status()).toBe(403);
    expect(await detail(admin!, id)).toMatchObject({
      status: "in_review",
      version: 1,
      fileCount: 1,
    });
  } finally {
    await grants.revoke();
    await reader?.dispose();
    await admin!.dispose();
  }
});

test("equipe sem a chave de revisão recebe 403 próprio, não o de segregação", async ({
  playwright,
  baseURL,
}) => {
  const [assessor, coordinator, reviewer] = await signInAll(
    playwright,
    baseURL!,
    "assessorA",
    "coordinatorA",
    "reviewer",
  );
  try {
    const teamA = await unitId(assessor!, auditTeams.a);
    const { id } = await create(assessor!, teamA);
    for (const data of [
      { action: "approve", version: 1 },
      { action: "request_correction", version: 1, message: "Sem a chave." },
      { action: "reopen", version: 1, message: "Sem a chave." },
    ]) {
      const response = await transition(coordinator!, id, data);
      expect(response.status()).toBe(403);
      expect((await response.json()).message).not.toContain("Quem enviou");
    }
    // A Subcontroladoria não envia documentos.
    expect(
      (
        await createDocument(
          reviewer!,
          { unitId: teamA, title: "Envio da revisão" },
          docxFile(),
        )
      ).status(),
    ).toBe(403);
    const options = await (
      await reviewer!.get("/api/audit-documents/options")
    ).json();
    expect(options.units).toEqual([]);
    expect(
      options.visibleUnits.map((unit: { name: string }) => unit.name),
    ).toEqual(expect.arrayContaining([auditTeams.a, auditTeams.b]));
  } finally {
    await Promise.all(
      [assessor, coordinator, reviewer].map((client) => client!.dispose()),
    );
  }
});

test("equipe vê, abre, baixa e cancela documentos de colegas", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator, assessor] = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "assessorA",
  );
  try {
    const teamA = await unitId(coordinator!, auditTeams.a);
    const { id, fileId } = await create(coordinator!, teamA);
    expect(await listIds(assessor!, "?status=in_review")).toContain(id);
    expect((await detail(assessor!, id)).allowedActions).toEqual(["cancel"]);
    expect(
      (
        await assessor!.get(
          `/api/audit-documents/${id}/files/${fileId}?disposition=attachment`,
        )
      ).status(),
    ).toBe(200);
    const cancelled = await transition(assessor!, id, {
      action: "cancel",
      version: 1,
      message: "Duplicado pela colega.",
    });
    expect(cancelled.status()).toBe(200);
    expect((await cancelled.json()).status).toBe("cancelled");
  } finally {
    await Promise.all([coordinator!.dispose(), assessor!.dispose()]);
  }
});

test("escopo por unidade é exato: a unidade superior não vê a subordinada", async ({
  playwright,
  baseURL,
}) => {
  const [admin] = await signInAll(playwright, baseURL!, "admin");
  const grants = overrides(admin!);
  let parentUser: APIRequestContext | undefined;
  try {
    const parent = await dedicatedUnit(admin!, "Unidade superior E2E");
    const child = await dedicatedUnit(
      admin!,
      "Unidade subordinada E2E",
      parent.id,
    );
    const account = await freshAccount(playwright, baseURL!, admin!, parent.id);
    parentUser = account.client;
    await grants.add(account.id, "audit_documents.read", parent.id);
    await grants.add(account.id, "audit_documents.submit", parent.id);
    const own = await create(parentUser, parent.id);
    const { id } = await create(admin!, child.id);

    const listed = await listIds(parentUser);
    expect(listed).toContain(own.id);
    expect(listed).not.toContain(id);
    expect(
      (
        await parentUser.get(`/api/audit-documents?unitId=${child.id}`)
      ).status(),
    ).toBe(403);
    expect((await parentUser.get(`/api/audit-documents/${id}`)).status()).toBe(
      404,
    );
    expect(await visibleUnitNames(parentUser)).toEqual([parent.name]);
    expect(
      (
        await createDocument(
          parentUser,
          { unitId: child.id, title: "Envio para a subordinada" },
          docxFile(),
        )
      ).status(),
    ).toBe(403);
  } finally {
    await grants.revoke();
    await parentUser?.dispose();
    await admin!.dispose();
  }
});

// Negações só existem com escopo global (AccessService recusa negação por
// unidade), e prevalecem sobre qualquer permissão concedida.
test("negação da revisão prevalece sobre a revisão concedida", async ({
  playwright,
  baseURL,
}) => {
  const [admin, coordinatorA] = await signInAll(
    playwright,
    baseURL!,
    "admin",
    "coordinatorA",
  );
  const grants = overrides(admin!);
  let reviewer: APIRequestContext | undefined;
  try {
    const teamA = await unitId(admin!, auditTeams.a);
    const account = await freshAccount(playwright, baseURL!, admin!, teamA);
    reviewer = account.client;
    await grants.add(account.id, "audit_documents.review", teamA);
    const first = await create(coordinatorA!, teamA);
    expect((await detail(reviewer, first.id)).allowedActions).toContain(
      "approve",
    );

    await grants.add(account.id, "audit_documents.review", null, "deny");
    await grants.add(account.id, "audit_documents.read", teamA);
    const { id } = await create(coordinatorA!, teamA);
    expect((await detail(reviewer, id)).allowedActions).toEqual([]);
    for (const data of [
      { action: "approve", version: 1 },
      { action: "request_correction", version: 1, message: "Negada." },
      { action: "cancel", version: 1, message: "Negada." },
    ])
      expect((await transition(reviewer, id, data)).status()).toBe(403);
    expect(
      (
        await uploadVersion(
          reviewer,
          id,
          { version: 1, source: "editor" },
          docxFile(),
        )
      ).status(),
    ).toBe(403);
    expect(await detail(admin!, id)).toMatchObject({
      status: "in_review",
      version: 1,
    });
  } finally {
    await grants.revoke();
    await reviewer?.dispose();
    await Promise.all([admin, coordinatorA].map((client) => client!.dispose()));
  }
});

test("negação da leitura esconde lista, detalhe, arquivo e opções", async ({
  playwright,
  baseURL,
}) => {
  const [admin, coordinatorA] = await signInAll(
    playwright,
    baseURL!,
    "admin",
    "coordinatorA",
  );
  const grants = overrides(admin!);
  let reader: APIRequestContext | undefined;
  try {
    const teamA = await unitId(admin!, auditTeams.a);
    const account = await freshAccount(playwright, baseURL!, admin!, teamA);
    reader = account.client;
    await grants.add(account.id, "audit_documents.read", teamA);
    const { id, fileId } = await create(coordinatorA!, teamA);
    expect(await listIds(reader)).toContain(id);

    await grants.add(account.id, "audit_documents.read", null, "deny");
    expect((await reader.get("/api/audit-documents")).status()).toBe(403);
    expect((await reader.get("/api/audit-documents/options")).status()).toBe(
      403,
    );
    for (const response of [
      await reader.get(`/api/audit-documents/${id}`),
      await reader.get(`/api/audit-documents/${id}/files/${fileId}`),
    ])
      expect(response.status()).toBe(404);
    const denied = await auditRows(admin!, id, {
      outcome: "denied",
      action: "audit-document.access-denied",
    });
    expect(
      denied.filter((row) => row.actor?.accountId === account.id),
    ).toHaveLength(2);
  } finally {
    await grants.revoke();
    await reader?.dispose();
    await Promise.all([admin, coordinatorA].map((client) => client!.dispose()));
  }
});

test("indicadores respeitam a chave de relatórios por equipe", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator, assessor, admin] = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "assessorA",
    "admin",
  );
  try {
    const teamA = await unitId(admin!, auditTeams.a);
    const teamB = await unitId(admin!, auditTeams.b);
    const metrics = (query: string) =>
      coordinator!.get(
        `/api/audit-documents/metrics?from=2003-03-10&to=2003-03-10${query}`,
      );
    expect(
      (
        await assessor!.get(
          "/api/audit-documents/metrics?from=2003-03-10&to=2003-03-10",
        )
      ).status(),
    ).toBe(403);
    expect((await metrics(`&unitId=${teamB}`)).status()).toBe(403);
    for (const query of [`&unitId=${teamA}`, ""]) {
      const response = await metrics(query);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.units).toEqual([{ id: teamA, name: auditTeams.a }]);
      for (const row of body.pending as { unitId: string }[])
        expect(row.unitId).toBe(teamA);
    }
  } finally {
    await Promise.all(
      [coordinator, assessor, admin].map((client) => client!.dispose()),
    );
  }
});
