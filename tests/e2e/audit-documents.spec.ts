import { auditRows } from "./audit-document-api";
import {
  auditAccounts,
  auditTeams,
  createDocument,
  docxFile,
  docxMime,
  pdfFile,
  signIn,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test, tuple } from "./fixtures";
import { blankPdf } from "./pdf-fixture";

type Detail = {
  id: string;
  status: string;
  version: number;
  fileCount: number;
  correctionRounds: number;
  allowedActions: string[];
  files: { id: string; number: number; kind: string; sha256: string }[];
  events: { type: string; actorAccountId: string; fileId: string | null }[];
};

test("documento de auditoria percorre envio, correção, aprovação e reabertura", async ({
  playwright,
  baseURL,
}) => {
  const coordinator = await signIn(
    playwright,
    baseURL!,
    auditAccounts.coordinatorA,
  );
  const reviewer = await signIn(playwright, baseURL!, auditAccounts.reviewer);
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const created = await createDocument(
      coordinator,
      {
        unitId: teamA,
        title: "Relatório preliminar de auditoria E2E",
        reference: "RA-E2E-001",
        category: "Relatório preliminar",
      },
      docxFile("relatório preliminar.docx"),
    );
    expect(created.status()).toBe(201);
    const document = (await created.json()) as Detail;
    expect(document).toMatchObject({
      status: "in_review",
      version: 1,
      fileCount: 1,
      correctionRounds: 0,
    });
    const id = document.id;

    const queue = await reviewer.get("/api/audit-documents?status=in_review");
    expect(queue.status()).toBe(200);
    expect(queue.headers()["cache-control"]).toBe("no-store");
    const listed = (
      (await queue.json()).documents as {
        id: string;
        latestFileId: string;
        latestFileName: string;
        latestFileKind: string;
      }[]
    ).find((item) => item.id === id);
    expect(listed).toMatchObject({
      latestFileId: document.files[0]!.id,
      latestFileName: "relatório preliminar.docx",
      latestFileKind: "docx",
    });

    const detail = await reviewer.get(`/api/audit-documents/${id}`);
    expect(detail.status()).toBe(200);
    const opened = (await detail.json()) as Detail;
    expect(opened.allowedActions).toEqual(
      expect.arrayContaining(["approve", "request_correction", "cancel"]),
    );
    expect(opened.files).toHaveLength(1);
    expect(opened.files[0]).toMatchObject({ number: 1, kind: "docx" });
    expect(opened.files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);

    // Abrir o arquivo registra a leitura uma única vez por pessoa e versão.
    const fileId = opened.files[0]!.id;
    for (let attempt = 0; attempt < 2; attempt++) {
      const file = await reviewer.get(
        `/api/audit-documents/${id}/files/${fileId}`,
      );
      expect(file.status()).toBe(200);
      expect(file.headers()["cache-control"]).toBe("no-store");
      expect(file.headers()["content-type"]).toBe(docxMime);
      expect((await file.body()).subarray(0, 2).toString()).toBe("PK");
    }
    const reads = (
      (await (
        await reviewer.get(`/api/audit-documents/${id}`)
      ).json()) as Detail
    ).events.filter((event) => event.type === "read");
    expect(reads).toHaveLength(1);
    expect(reads[0]!.fileId).toBe(fileId);

    // Download explícito sai como anexo; o nome original segue a RFC 5987.
    const url = `/api/audit-documents/${id}/files/${fileId}`;
    const encodedName = "filename*=UTF-8''relat%C3%B3rio%20preliminar.docx";
    const inline = await reviewer.get(`${url}?disposition=inline`);
    expect(inline.headers()["content-disposition"]).toMatch(/^inline;/);
    expect(inline.headers()["content-disposition"]).toContain(encodedName);
    const attachment = await reviewer.get(`${url}?disposition=attachment`);
    expect(attachment.status()).toBe(200);
    expect(attachment.headers()["content-disposition"]).toMatch(/^attachment;/);
    expect(attachment.headers()["content-disposition"]).toContain(encodedName);
    expect((await reviewer.get(`${url}?disposition=other`)).status()).toBe(400);
    const admin = await signIn(playwright, baseURL!, auditAccounts.admin);
    try {
      const actions = (
        await auditRows(admin, id, {
          action: "audit-document.file-viewed,audit-document.file-downloaded",
        })
      )
        .map((event) => event.action)
        .sort();
      expect(actions).toEqual([
        "audit-document.file-downloaded",
        "audit-document.file-viewed",
        "audit-document.file-viewed",
        "audit-document.file-viewed",
      ]);
    } finally {
      await admin.dispose();
    }

    // Versão desatualizada e ação sem justificativa são recusadas.
    expect(
      (
        await reviewer.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "approve", version: 7 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await reviewer.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "request_correction", version: 1 },
        })
      ).status(),
    ).toBe(400);

    const correction = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      {
        data: {
          action: "request_correction",
          version: 1,
          message: "Revisar a matriz de achados.",
        },
      },
    );
    expect(correction.status()).toBe(200);
    expect(await correction.json()).toMatchObject({
      status: "correction_requested",
      version: 2,
      correctionRounds: 1,
    });
    expect(
      (
        await reviewer.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "approve", version: 2 },
        })
      ).status(),
    ).toBe(409);

    // A nova versão com versão desatualizada é recusada antes de gravar.
    expect(
      (
        await uploadVersion(coordinator, id, { version: 1 }, pdfFile())
      ).status(),
    ).toBe(409);
    const resubmitted = await uploadVersion(
      coordinator,
      id,
      { version: 2, note: "Matriz revisada." },
      pdfFile(),
    );
    expect(resubmitted.status()).toBe(201);
    expect(await resubmitted.json()).toMatchObject({
      status: "in_review",
      version: 3,
      fileCount: 2,
    });

    const approved = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      { data: { action: "approve", version: 3 } },
    );
    expect(approved.status()).toBe(200);
    expect(await approved.json()).toMatchObject({
      status: "approved",
      version: 4,
    });

    expect(
      (
        await reviewer.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "reopen", version: 4 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await coordinator.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "reopen", version: 4, message: "Reabrir." },
        })
      ).status(),
    ).toBe(403);
    const reopened = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      {
        data: {
          action: "reopen",
          version: 4,
          message: "Ajuste solicitado após a aprovação.",
        },
      },
    );
    expect(reopened.status()).toBe(200);
    expect(await reopened.json()).toMatchObject({
      status: "in_review",
      version: 5,
    });
    const final = await reviewer.post(`/api/audit-documents/${id}/transition`, {
      data: { action: "approve", version: 5 },
    });
    expect(final.status()).toBe(200);
    expect((await final.json()).status).toBe("approved");

    const history = (await (
      await coordinator.get(`/api/audit-documents/${id}`)
    ).json()) as Detail;
    expect(
      history.events
        .map((event) => event.type)
        .filter((type) => type !== "read"),
    ).toEqual([
      "submitted",
      "correction_requested",
      "resubmitted",
      "approved",
      "reopened",
      "approved",
    ]);
    expect(history.allowedActions).toEqual([]);
  } finally {
    await coordinator.dispose();
    await reviewer.dispose();
  }
});

test("quem enviou a versão atual não pode analisá-la", async ({
  playwright,
  baseURL,
}) => {
  const admin = await signIn(playwright, baseURL!, auditAccounts.admin);
  const reviewer = await signIn(playwright, baseURL!, auditAccounts.reviewer);
  try {
    const teamA = await unitId(admin, auditTeams.a);
    const created = await createDocument(
      admin,
      { unitId: teamA, title: "Nota técnica E2E segregação" },
      pdfFile(),
    );
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const detail = (await (
      await admin.get(`/api/audit-documents/${id}`)
    ).json()) as Detail;
    expect(detail.allowedActions).not.toContain("approve");
    expect(detail.allowedActions).not.toContain("request_correction");
    for (const data of [
      { action: "approve", version: 1 },
      { action: "request_correction", version: 1, message: "Autoanálise." },
    ])
      expect(
        (
          await admin.post(`/api/audit-documents/${id}/transition`, { data })
        ).status(),
      ).toBe(403);
    expect(
      (
        await reviewer.post(`/api/audit-documents/${id}/transition`, {
          data: { action: "approve", version: 1 },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await admin.dispose();
    await reviewer.dispose();
  }
});

test("upload recusa arquivo que não é DOCX nem PDF pesquisável", async ({
  playwright,
  baseURL,
}) => {
  const coordinator = await signIn(
    playwright,
    baseURL!,
    auditAccounts.coordinatorA,
  );
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const response = await createDocument(
      coordinator,
      { unitId: teamA, title: "Arquivo inválido E2E" },
      {
        name: "planilha.doc",
        mimeType: "application/msword",
        buffer: Buffer.from("texto simples, não é documento"),
      },
    );
    expect(response.status()).toBe(400);
    const scanned = await createDocument(
      coordinator,
      { unitId: teamA, title: "PDF sem camada de texto E2E" },
      {
        name: "digitalizado.pdf",
        mimeType: "application/pdf",
        buffer: blankPdf,
      },
    );
    expect(scanned.status()).toBe(400);
    expect((await scanned.json()).message).toContain("OCR");
  } finally {
    await coordinator.dispose();
  }
});

test("versões editadas no navegador respeitam etapa, papel e concorrência", async ({
  playwright,
  baseURL,
}) => {
  const clients = await Promise.all(
    [
      auditAccounts.coordinatorA,
      auditAccounts.assessorA,
      auditAccounts.reviewer,
    ].map((email) => signIn(playwright, baseURL!, email)),
  );
  const [coordinator, assessor, reviewer] = tuple(clients, 3);
  type Versioned = Detail & {
    files: { source: string; uploadedAs: string; number: number }[];
  };
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const created = await createDocument(
      coordinator,
      { unitId: teamA, title: "Relatório editado no navegador E2E" },
      docxFile(),
    );
    expect(created.status()).toBe(201);
    const document = (await created.json()) as Versioned;
    expect(document.files[0]).toMatchObject({
      source: "upload",
      uploadedAs: "team",
    });
    const id = document.id;
    const edit = (
      client: typeof reviewer,
      version: number,
      source = "editor",
    ) =>
      uploadVersion(client, id, { version, source }, docxFile("editado.docx"));

    // Em análise, só a Subcontroladoria salva uma versão editada.
    expect((await edit(assessor, 1)).status()).toBe(403);
    const edited = await edit(reviewer, 1);
    expect(edited.status()).toBe(201);
    const afterEdit = (await edited.json()) as Versioned;
    expect(afterEdit).toMatchObject({ status: "in_review", version: 2 });
    expect(afterEdit.files[1]).toMatchObject({
      number: 2,
      source: "editor",
      uploadedAs: "reviewer",
    });
    expect(afterEdit.events.at(-1)!.type).toBe("edited");
    expect((await edit(reviewer, 1)).status()).toBe(409);

    const correction = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      {
        data: {
          action: "request_correction",
          version: 2,
          message: "Revise o trecho que editei.",
        },
      },
    );
    expect(correction.status()).toBe(200);
    // Na correção, a equipe salva pelo editor e o documento volta à análise.
    expect((await edit(reviewer, 3)).status()).toBe(403);
    const resubmitted = await edit(coordinator, 3);
    expect(resubmitted.status()).toBe(201);
    const afterTeam = (await resubmitted.json()) as Versioned;
    expect(afterTeam).toMatchObject({ status: "in_review", version: 4 });
    expect(afterTeam.files[2]).toMatchObject({
      source: "editor",
      uploadedAs: "team",
    });
    expect(afterTeam.events.at(-1)!.type).toBe("resubmitted");

    // Quem só editou como revisora pode aprovar a própria edição.
    expect((await edit(reviewer, 4)).status()).toBe(201);
    const approved = await reviewer.post(
      `/api/audit-documents/${id}/transition`,
      { data: { action: "approve", version: 5 } },
    );
    expect(approved.status()).toBe(200);
    expect((await approved.json()).status).toBe("approved");
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
