import type { APIRequestContext } from "@playwright/test";

import {
  accountId,
  detail,
  freshAccount,
  inboxItems,
  overrides,
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

const stale = "Este documento foi atualizado";

async function create(client: APIRequestContext, unit: string) {
  const response = await createDocument(
    client,
    { unitId: unit, title: unique("Documento de etapas E2E") },
    docxFile(),
  );
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function ok(response: Awaited<ReturnType<typeof transition>>) {
  expect(response.status(), await response.text()).toBeLessThan(300);
}

const upload = (client: APIRequestContext, id: string, version: number) =>
  uploadVersion(client, id, { version }, pdfFile());
const edit = (client: APIRequestContext, id: string, version: number) =>
  uploadVersion(client, id, { version, source: "editor" }, docxFile());

const sorted = (values: string[]) => [...values].sort();

/** The document must not change: same version, no new event, no new file. */
async function unchanged(
  client: APIRequestContext,
  id: string,
  attempt: () => Promise<{ status(): number; json(): Promise<unknown> }>,
  status: number,
  message?: string,
) {
  const before = await detail(client, id);
  const response = await attempt();
  expect(response.status()).toBe(status);
  if (message)
    expect(((await response.json()) as { message: string }).message).toContain(
      message,
    );
  const after = await detail(client, id);
  expect(after.version).toBe(before.version);
  expect(after.status).toBe(before.status);
  expect(after.files).toHaveLength(before.files.length);
  expect(after.events.filter((event) => event.type !== "read")).toHaveLength(
    before.events.filter((event) => event.type !== "read").length,
  );
}

test("trilha de eventos guarda origem, destino e justificativas", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
  );
  const [coordinator, reviewer] = clients as [
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const id = await create(coordinator, teamA);
    await ok(
      await transition(reviewer, id, {
        action: "request_correction",
        version: 1,
        message: "  Anexar a matriz de riscos.  ",
      }),
    );
    await ok(await upload(coordinator, id, 2));
    await ok(await transition(reviewer, id, { action: "approve", version: 3 }));
    await ok(
      await transition(reviewer, id, {
        action: "reopen",
        version: 4,
        message: "Rever conclusão.",
      }),
    );
    await ok(await edit(reviewer, id, 5));
    await ok(
      await transition(coordinator, id, {
        action: "cancel",
        version: 6,
        message: "Substituído por outro relatório.",
      }),
    );
    const events = (await detail(coordinator, id)).events.map(
      ({ type, fromStatus, toStatus, message }) => ({
        type,
        fromStatus,
        toStatus,
        message,
      }),
    );
    expect(events).toEqual([
      {
        type: "submitted",
        fromStatus: null,
        toStatus: "in_review",
        message: null,
      },
      {
        type: "correction_requested",
        fromStatus: "in_review",
        toStatus: "correction_requested",
        message: "Anexar a matriz de riscos.",
      },
      {
        type: "resubmitted",
        fromStatus: "correction_requested",
        toStatus: "in_review",
        message: null,
      },
      {
        type: "approved",
        fromStatus: "in_review",
        toStatus: "approved",
        message: null,
      },
      {
        type: "reopened",
        fromStatus: "approved",
        toStatus: "in_review",
        message: "Rever conclusão.",
      },
      {
        type: "edited",
        fromStatus: "in_review",
        toStatus: "in_review",
        message: null,
      },
      {
        type: "cancelled",
        fromStatus: "in_review",
        toStatus: "cancelled",
        message: "Substituído por outro relatório.",
      },
    ]);
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

test("ações válidas pela permissão, mas não pela etapa, recebem 409 sem efeito", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
  );
  const [coordinator, reviewer] = clients as [
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const inReview = await create(coordinator, teamA);
    const approved = await create(coordinator, teamA);
    await ok(
      await transition(reviewer, approved, { action: "approve", version: 1 }),
    );
    const illegal = "não está disponível na etapa atual";

    await unchanged(
      reviewer,
      inReview,
      () =>
        transition(reviewer, inReview, {
          action: "reopen",
          version: 1,
          message: "Reabrir em análise.",
        }),
      409,
      illegal,
    );
    for (const [client, data] of [
      [coordinator, { action: "cancel", version: 2, message: "Cancelar." }],
      [reviewer, { action: "cancel", version: 2, message: "Cancelar." }],
      [
        reviewer,
        { action: "request_correction", version: 2, message: "Corrigir." },
      ],
      [reviewer, { action: "approve", version: 2 }],
    ] as const)
      await unchanged(
        reviewer,
        approved,
        () => transition(client, approved, data),
        409,
        illegal,
      );
    // A equipe envia versão só após pedido de correção.
    await unchanged(
      reviewer,
      approved,
      () => upload(coordinator, approved, 2),
      409,
      "não aceita novas versões",
    );
    // Em análise, a nova versão é edição da revisão: a equipe não tem a chave (403 antes de 409).
    await unchanged(
      reviewer,
      inReview,
      () => upload(coordinator, inReview, 1),
      403,
    );
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

test("documento cancelado é final para todos", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "assessorA",
    "reviewer",
  );
  const [coordinator, assessor, reviewer] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    for (const fromCorrection of [false, true]) {
      const id = await create(coordinator, teamA);
      let version = 1;
      if (fromCorrection) {
        await ok(
          await transition(reviewer, id, {
            action: "request_correction",
            version: version++,
            message: "Corrigir antes de cancelar.",
          }),
        );
      }
      const cancelled = await transition(assessor, id, {
        action: "cancel",
        version: version++,
        message: "Documento enviado em duplicidade.",
      });
      expect(cancelled.status()).toBe(200);
      expect(await cancelled.json()).toMatchObject({
        status: "cancelled",
        version,
      });
      for (const [client, data] of [
        [reviewer, { action: "approve", version }],
        [
          reviewer,
          { action: "request_correction", version, message: "X y z." },
        ],
        [
          reviewer,
          { action: "reopen", version, message: "Reabrir cancelado." },
        ],
        [reviewer, { action: "cancel", version, message: "De novo." }],
        [coordinator, { action: "cancel", version, message: "De novo." }],
      ] as const)
        await unchanged(reviewer, id, () => transition(client, id, data), 409);
      await unchanged(
        reviewer,
        id,
        () => upload(coordinator, id, version),
        409,
      );
      await unchanged(reviewer, id, () => upload(reviewer, id, version), 403);
      for (const client of clients)
        expect((await detail(client!, id)).allowedActions).toEqual([]);
      for (const client of clients)
        expect(
          (await inboxItems(client!)).map((item) => item.id),
        ).not.toContain(`audit_document:${id}`);
    }
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

test("justificativa vazia ou só com espaços é recusada", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
  );
  const [coordinator, reviewer] = clients as [
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const id = await create(coordinator, teamA);
    const approved = await create(coordinator, teamA);
    await ok(
      await transition(reviewer, approved, { action: "approve", version: 1 }),
    );
    for (const message of [undefined, "   "]) {
      for (const [client, action] of [
        [coordinator, "cancel"],
        [reviewer, "cancel"],
        [reviewer, "request_correction"],
      ] as const)
        await unchanged(
          reviewer,
          id,
          () => transition(client, id, { action, version: 1, message }),
          400,
        );
      await unchanged(
        reviewer,
        approved,
        () =>
          transition(reviewer, approved, {
            action: "reopen",
            version: 2,
            message,
          }),
        400,
      );
    }
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

test("ações permitidas por papel e etapa", async ({ playwright, baseURL }) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "assessorA",
    "coordinatorA",
    "reviewer",
    "admin",
  );
  const [assessor, coordinator, reviewer, admin] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  const grants = overrides(admin);
  let reader: APIRequestContext | undefined;
  try {
    const teamA = await unitId(admin, auditTeams.a);
    const account = await freshAccount(playwright, baseURL!, admin, teamA);
    reader = account.client;
    await grants.add(account.id, "audit_documents.read", teamA);

    // Um documento em cada etapa, enviado pela assessoria ou pelo admin (equipe).
    async function inEachStatus(uploader: APIRequestContext) {
      const docs = {
        in_review: await create(uploader, teamA),
        correction_requested: await create(uploader, teamA),
        approved: await create(uploader, teamA),
        cancelled: await create(uploader, teamA),
      };
      await ok(
        await transition(reviewer, docs.correction_requested, {
          action: "request_correction",
          version: 1,
          message: "Corrigir a seção 2.",
        }),
      );
      await ok(
        await transition(reviewer, docs.approved, {
          action: "approve",
          version: 1,
        }),
      );
      await ok(
        await transition(reviewer, docs.cancelled, {
          action: "cancel",
          version: 1,
          message: "Cancelar documento.",
        }),
      );
      return docs;
    }
    const expectActions = async (
      client: APIRequestContext,
      docs: Record<string, string>,
      expected: Record<string, string[]>,
    ) => {
      for (const [status, id] of Object.entries(docs))
        expect(
          sorted((await detail(client, id)).allowedActions),
          `${status}`,
        ).toEqual(sorted(expected[status]!));
    };

    const byAssessor = await inEachStatus(assessor);
    await expectActions(coordinator, byAssessor, {
      in_review: ["cancel"],
      correction_requested: ["submit_version", "cancel"],
      approved: [],
      cancelled: [],
    });
    await expectActions(reviewer, byAssessor, {
      in_review: ["approve", "request_correction", "cancel", "edit_version"],
      correction_requested: ["cancel"],
      approved: ["reopen"],
      cancelled: [],
    });
    await expectActions(reader, byAssessor, {
      in_review: [],
      correction_requested: [],
      approved: [],
      cancelled: [],
    });
    // Admin tem envio e revisão; enviou a versão atual como equipe (Q2: não edita).
    const byAdmin = await inEachStatus(admin);
    await expectActions(admin, byAdmin, {
      in_review: ["cancel"],
      correction_requested: ["submit_version", "cancel"],
      approved: ["reopen"],
      cancelled: [],
    });
  } finally {
    await grants.revoke();
    await reader?.dispose();
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

test("segregação de funções acompanha quem enviou a versão atual como equipe", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "reviewer",
    "admin",
  );
  const [coordinator, reviewer, admin] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(admin, auditTeams.a);
    const correct = (id: string, version: number) =>
      transition(reviewer, id, {
        action: "request_correction",
        version,
        message: "Ajustar evidências.",
      });

    // SD-04: a versão atual passou a ser de outra pessoa; o admin pode aprovar.
    const sd04 = await create(admin, teamA);
    await ok(await correct(sd04, 1));
    await ok(await upload(coordinator, sd04, 2));
    expect((await detail(admin, sd04)).allowedActions).toContain("approve");
    await ok(await transition(admin, sd04, { action: "approve", version: 3 }));

    // SD-05: o admin respondeu a correção como equipe; só outra revisão decide.
    const sd05 = await create(coordinator, teamA);
    await ok(await correct(sd05, 1));
    await ok(await upload(admin, sd05, 2));
    for (const data of [
      { action: "approve", version: 3 },
      { action: "request_correction", version: 3, message: "Autoanálise." },
    ])
      await unchanged(
        reviewer,
        sd05,
        () => transition(admin, sd05, data),
        403,
        "Quem enviou a versão atual",
      );
    await ok(
      await transition(reviewer, sd05, { action: "approve", version: 3 }),
    );

    // SD-06: segregação não impede cancelar o próprio envio.
    const sd06 = await create(admin, teamA);
    await ok(
      await transition(admin, sd06, {
        action: "cancel",
        version: 1,
        message: "Cancelado por quem enviou.",
      }),
    );

    // Q2: quem enviou a versão atual como equipe também não edita como revisão.
    const q2 = await create(admin, teamA);
    await unchanged(reviewer, q2, () => edit(admin, q2, 1), 403);

    // SD-07: edição da revisão sobre a versão de outra pessoa; depois aprova.
    const sd07 = await create(admin, teamA);
    await ok(await correct(sd07, 1));
    await ok(await upload(coordinator, sd07, 2));
    const edited = await edit(admin, sd07, 3);
    expect(edited.status()).toBe(201);
    expect((await edited.json()).files.at(-1)).toMatchObject({
      uploadedAs: "reviewer",
      uploadedByAccountId: await accountId(admin),
    });
    await ok(await transition(admin, sd07, { action: "approve", version: 4 }));
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});

// Q1: 401 > 404 (escopo) > 403 (chave ou segregação) > 409 (versão) > 409 (etapa).
test("precedência dos erros quando mais de uma regra falha", async ({
  playwright,
  baseURL,
}) => {
  const clients = await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
    "assessorB",
    "reviewer",
    "admin",
  );
  const [coordinator, outsider, reviewer, admin] = clients as [
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
    APIRequestContext,
  ];
  try {
    const teamA = await unitId(admin, auditTeams.a);
    const id = await create(coordinator, teamA);
    const own = await create(admin, teamA);
    const approved = await create(coordinator, teamA);
    await ok(
      await transition(reviewer, approved, { action: "approve", version: 1 }),
    );
    const corrected = await create(coordinator, teamA);
    await ok(
      await transition(reviewer, corrected, {
        action: "request_correction",
        version: 1,
        message: "Corrigir anexos.",
      }),
    );

    // Fora do escopo, sem chave e com versão velha: 404.
    await unchanged(
      reviewer,
      id,
      () => transition(outsider, id, { action: "approve", version: 99 }),
      404,
    );
    await unchanged(reviewer, id, () => upload(outsider, id, 99), 404);
    // Sem a chave e com versão velha, ou em etapa inválida: 403.
    await unchanged(
      reviewer,
      id,
      () => transition(coordinator, id, { action: "approve", version: 99 }),
      403,
    );
    await unchanged(
      reviewer,
      id,
      () =>
        transition(coordinator, id, {
          action: "reopen",
          version: 1,
          message: "Reabrir sem chave.",
        }),
      403,
    );
    // Em nova versão, a ação depende da etapa que o remetente viu: com versão
    // velha a resposta é 409 (recarregar); na versão atual, 403.
    await unchanged(
      reviewer,
      corrected,
      () => upload(reviewer, corrected, 99),
      409,
      stale,
    );
    await unchanged(
      reviewer,
      corrected,
      () => upload(reviewer, corrected, 2),
      403,
    );
    // Segregação vence a versão velha.
    await unchanged(
      reviewer,
      own,
      () => transition(admin, own, { action: "approve", version: 99 }),
      403,
      "Quem enviou a versão atual",
    );
    // Versão velha vence a etapa inválida.
    await unchanged(
      reviewer,
      approved,
      () => transition(reviewer, approved, { action: "approve", version: 1 }),
      409,
      stale,
    );
    await unchanged(
      reviewer,
      approved,
      () => upload(coordinator, approved, 1),
      409,
      stale,
    );
  } finally {
    await Promise.all(clients.map((client) => client!.dispose()));
  }
});
