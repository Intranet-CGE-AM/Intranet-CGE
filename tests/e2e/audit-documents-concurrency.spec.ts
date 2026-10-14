import type { APIRequestContext } from "@playwright/test";

import {
  auditRows,
  detail,
  signInAll,
  transition,
  unique,
} from "./audit-document-api";
import {
  auditTeams,
  createDocument,
  docxFile,
  pdfFile,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test } from "./fixtures";

// Requests fire together from separate sessions; only outcome counts are
// asserted, never which request won.

async function create(client: APIRequestContext, unit: string) {
  const response = await createDocument(
    client,
    { unitId: unit, title: unique("Documento concorrente E2E") },
    docxFile(),
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: string; files: { id: string }[] };
}

const statuses = (responses: { status(): number }[]) =>
  responses.map((response) => response.status()).sort();

test("decisões simultâneas na mesma versão: uma vence, a outra recebe 409", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
    "reviewer",
    "admin",
  );
  const [coordinator, reviewer, secondSession, admin] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    for (const [first, second] of [
      [
        { action: "approve", version: 1 },
        {
          action: "request_correction",
          version: 1,
          message: "Rever os achados.",
        },
      ],
      [
        { action: "approve", version: 1 },
        { action: "approve", version: 1 },
      ],
      [
        { action: "cancel", version: 1, message: "Cancelar pela revisão." },
        { action: "approve", version: 1 },
      ],
    ]) {
      const { id } = await create(coordinator, teamA);
      const responses = await Promise.all([
        transition(reviewer, id, first!),
        transition(secondSession, id, second!),
      ]);
      expect(statuses(responses)).toEqual([200, 409]);
      const after = await detail(coordinator, id);
      expect(after.version).toBe(2);
      expect(
        after.events.filter((event) => event.type !== "read"),
      ).toHaveLength(2);
      const decisions = await auditRows(admin, id, {
        action: [first!.action, second!.action]
          .map((action) => `audit-document.${action}`)
          .join(","),
      });
      expect(decisions).toHaveLength(1);
    }
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("envios simultâneos da mesma versão geram um único arquivo", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "assessorA",
    "reviewer",
    "reviewer",
  );
  const [coordinator, assessor, reviewer, secondSession] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    // Equipe respondendo a mesma correção duas vezes.
    const team = await create(coordinator, teamA);
    await transition(reviewer, team.id, {
      action: "request_correction",
      version: 1,
      message: "Enviar a nova versão.",
    });
    expect(
      statuses(
        await Promise.all([
          uploadVersion(coordinator, team.id, { version: 2 }, pdfFile()),
          uploadVersion(assessor, team.id, { version: 2 }, docxFile()),
        ]),
      ),
    ).toEqual([201, 409]);
    // Duas sessões da revisão salvando a edição da mesma versão.
    const edit = await create(coordinator, teamA);
    expect(
      statuses(
        await Promise.all(
          [reviewer, secondSession].map((client) =>
            uploadVersion(
              client,
              edit.id,
              { version: 1, source: "editor" },
              docxFile(),
            ),
          ),
        ),
      ),
    ).toEqual([201, 409]);
    for (const [id, status] of [
      [team.id, "in_review"],
      [edit.id, "in_review"],
    ] as const) {
      const after = await detail(coordinator, id);
      expect(after.files.map((file) => file.number)).toEqual([1, 2]);
      expect(after).toMatchObject({ status, version: id === team.id ? 3 : 2 });
    }
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("aberturas simultâneas do mesmo arquivo registram uma leitura", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
    "reviewer",
    "reviewer",
    "admin",
  );
  const [coordinator, ...rest] = clients as APIRequestContext[];
  const readers = rest.slice(0, 3);
  const admin = rest[3]!;
  try {
    const teamA = await unitId(coordinator!, auditTeams.a);
    const { id, files } = await create(coordinator!, teamA);
    const responses = await Promise.all(
      readers.map((client) =>
        client.get(`/api/audit-documents/${id}/files/${files[0]!.id}`),
      ),
    );
    expect(statuses(responses)).toEqual([200, 200, 200]);
    const reads = (await detail(coordinator!, id)).events.filter(
      (event) => event.type === "read",
    );
    expect(reads).toHaveLength(1);
    expect(reads[0]!.fileId).toBe(files[0]!.id);
    expect(
      await auditRows(admin, id, { action: "audit-document.file-viewed" }),
    ).toHaveLength(3);
    // Ler não muda a versão: a decisão com a versão lida ainda vale.
    expect(
      (
        await transition(readers[0]!, id, { action: "approve", version: 1 })
      ).status(),
    ).toBe(200);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
