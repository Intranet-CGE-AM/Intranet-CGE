import type { APIRequestContext } from "@playwright/test";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { createDatabase } from "../../apps/api/src/db/client.js";
import {
  auditRows,
  detail,
  e2eDatabaseUrl,
  e2eObjectStorageUrl,
  signInAll,
  transition,
  unique,
} from "./audit-document-api";
import {
  auditTeams,
  createDocument,
  docxFile,
  docxMime,
  pdfFile,
  sampleDocx,
  searchablePdf,
  unitId,
  uploadVersion,
} from "./audit-document-fixtures";
import { expect, test } from "./fixtures";

const maxBytes = 20 * 1024 * 1024;

/** Valid docx of exactly `size` bytes, padded with a stored random part. */
function docxOfSize(size: number) {
  const name = "word/media/padding.bin";
  const padded = (padding: Buffer) =>
    sampleDocx(undefined, { [name]: padding }, new Set([name]));
  const overhead = padded(Buffer.alloc(1)).length - 1;
  const buffer = padded(randomBytes(size - overhead));
  expect(buffer.length).toBe(size);
  return buffer;
}

/** Rewrites the uncompressed size an entry declares, in both zip headers. */
function lieAboutSize(zip: Buffer, name: string, size: number) {
  for (const [signature, sizeAt, nameAt, lengthAt] of [
    ["PK\x03\x04", 22, 30, 26],
    ["PK\x01\x02", 24, 46, 28],
  ] as const)
    for (
      let at = zip.indexOf(signature, 0, "latin1");
      at !== -1;
      at = zip.indexOf(signature, at + 4, "latin1")
    ) {
      const length = zip.readUInt16LE(at + lengthAt);
      if (zip.toString("latin1", at + nameAt, at + nameAt + length) === name)
        zip.writeUInt32LE(size, at + sizeAt);
    }
  return zip;
}

async function create(
  client: APIRequestContext,
  unit: string,
  file = docxFile(),
) {
  const response = await createDocument(
    client,
    { unitId: unit, title: unique("Documento de arquivos E2E") },
    file,
  );
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as Awaited<ReturnType<typeof detail>>;
}

const titleCount = async (client: APIRequestContext, title: string) =>
  (
    await (
      await client.get(
        `/api/audit-documents?query=${encodeURIComponent(title)}`,
      )
    ).json()
  ).total as number;

test("limite de 20 MB: exatamente 20 MB entra, 1 byte a mais recebe 413", async ({
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
    const title = unique("Arquivo grande demais E2E");
    const tooLarge = await createDocument(
      coordinator,
      { unitId: teamA, title },
      {
        name: "grande.docx",
        mimeType: docxMime,
        buffer: docxOfSize(maxBytes + 1),
      },
    );
    expect(tooLarge.status()).toBe(413);
    expect((await tooLarge.json()).message).toContain("20 MB");
    expect(await titleCount(coordinator, title)).toBe(0);

    const exact = docxOfSize(maxBytes);
    const created = await create(coordinator, teamA, {
      name: "limite.docx",
      mimeType: docxMime,
      buffer: exact,
    });
    expect(created.files[0]).toMatchObject({ size: maxBytes });
    const id = created.id;
    const download = await coordinator.get(
      `/api/audit-documents/${id}/files/${created.files[0]!.id}`,
    );
    expect((await download.body()).equals(exact)).toBe(true);

    // Nova versão acima do limite: 413 e nada muda.
    const edited = await uploadVersion(
      reviewer,
      id,
      { version: 1, source: "editor" },
      {
        name: "grande.docx",
        mimeType: docxMime,
        buffer: docxOfSize(maxBytes + 1),
      },
    );
    expect(edited.status()).toBe(413);
    expect(await detail(reviewer, id)).toMatchObject({
      version: 1,
      fileCount: 1,
    });
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("zip bomb com cabeçalho mentiroso é recusado sem descompactar tudo", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator] = (await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
  )) as [APIRequestContext];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    // 160 MiB de espaços viram ~160 KB; o cabeçalho declara 500 bytes.
    const bomb = lieAboutSize(
      sampleDocx(undefined, {
        "word/bomb.xml": Buffer.alloc(160 * 1024 * 1024, 32),
      }),
      "word/bomb.xml",
      500,
    );
    const title = unique("Zip bomb E2E");
    const started = Date.now();
    const response = await createDocument(
      coordinator,
      { unitId: teamA, title },
      { name: "bomba.docx", mimeType: docxMime, buffer: bomb },
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toContain("corrompido");
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await titleCount(coordinator, title)).toBe(0);
  } finally {
    await coordinator.dispose();
  }
});

test("arquivo inválido em nova versão é recusado sem alterar o documento", async ({
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
    const { id } = await create(coordinator, teamA);
    const invalid = [
      {
        name: "anexo.doc",
        mimeType: "application/msword",
        buffer: Buffer.from("texto"),
      },
      {
        name: "programa.docx",
        mimeType: docxMime,
        buffer: Buffer.concat([Buffer.from("MZ"), randomBytes(200)]),
      },
    ];
    // Edição da revisão em análise.
    for (const file of invalid) {
      const response = await uploadVersion(
        reviewer,
        id,
        { version: 1, source: "editor" },
        file,
      );
      expect(response.status()).toBe(400);
    }
    await transition(reviewer, id, {
      action: "request_correction",
      version: 1,
      message: "Enviar a versão corrigida.",
    });
    // Resposta da equipe à correção.
    for (const file of invalid) {
      const response = await uploadVersion(
        coordinator,
        id,
        { version: 2 },
        file,
      );
      expect(response.status()).toBe(400);
    }
    const after = await detail(coordinator, id);
    expect(after).toMatchObject({
      status: "correction_requested",
      version: 2,
      fileCount: 1,
    });
    expect(after.files).toHaveLength(1);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("cada versão guarda o SHA-256 e devolve os mesmos bytes", async ({
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
    const v1 = docxFile("primeira versão.docx");
    const v2 = pdfFile("segunda versão.pdf");
    const { id } = await create(coordinator, teamA, v1);
    await transition(reviewer, id, {
      action: "request_correction",
      version: 1,
      message: "Enviar em PDF.",
    });
    expect(
      (await uploadVersion(coordinator, id, { version: 2 }, v2)).status(),
    ).toBe(201);
    const { files } = await detail(reviewer, id);
    for (const [index, sent] of [v1, v2].entries()) {
      const file = files[index]!;
      expect(file).toMatchObject({
        number: index + 1,
        fileName: sent.name,
        size: sent.buffer.length,
        sha256: createHash("sha256").update(sent.buffer).digest("hex"),
      });
      const response = await reviewer.get(
        `/api/audit-documents/${id}/files/${file.id}`,
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe(sent.mimeType);
      // Sem `disposition`, o padrão é abrir na tela.
      expect(response.headers()["content-disposition"]).toMatch(/^inline;/);
      expect(response.headers()["content-disposition"]).toContain(
        `filename*=UTF-8''${encodeURIComponent(sent.name)}`,
      );
      const body = await response.body();
      expect(body.equals(sent.buffer)).toBe(true);
    }
    expect(
      (
        await (
          await reviewer.get(`/api/audit-documents/${id}/files/${files[1]!.id}`)
        ).body()
      )
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

/** multipart feito à mão, para mandar o nome em `filename*` (RFC 2231). */
function rawUpload(
  client: APIRequestContext,
  metadata: Record<string, unknown>,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
) {
  const boundary = `----audit${randomUUID()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename*=UTF-8''${encodeURIComponent(fileName)}\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`,
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return client.post("/api/audit-documents", {
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    data: body,
  });
}

test("nome enviado não injeta cabeçalho nem define o tipo do download", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator] = (await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
  )) as [APIRequestContext];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    for (const [name, mimeType, buffer, expectedName, served] of [
      [
        'a"b;\r\nX-Evil: 1.pdf',
        "application/pdf",
        searchablePdf(),
        "ab;X-Evil: 1.pdf",
        "application/pdf",
      ],
      [
        "pagina.html.docx",
        "text/html",
        sampleDocx(),
        "pagina.html.docx",
        docxMime,
      ],
      [
        "../../etc/relatorio.docx",
        docxMime,
        sampleDocx(),
        "relatorio.docx",
        docxMime,
      ],
    ] as const) {
      const response = await rawUpload(
        coordinator,
        { unitId: teamA, title: unique("Nome malicioso E2E") },
        name,
        mimeType,
        buffer,
      );
      // text/html declarado para .docx é divergência; o restante entra.
      if (mimeType === "text/html") {
        expect(response.status()).toBe(400);
        const retry = await rawUpload(
          coordinator,
          { unitId: teamA, title: unique("Nome malicioso E2E") },
          name,
          "application/octet-stream",
          buffer,
        );
        expect(retry.status()).toBe(201);
        await checkDownload(await retry.json(), expectedName, served);
        continue;
      }
      expect(response.status(), await response.text()).toBe(201);
      await checkDownload(await response.json(), expectedName, served);
    }
  } finally {
    await coordinator.dispose();
  }

  async function checkDownload(
    created: Awaited<ReturnType<typeof detail>>,
    expectedName: string,
    served: string,
  ) {
    const file = created.files[0]!;
    expect(file.fileName).toBe(expectedName);
    for (const disposition of ["inline", "attachment"]) {
      const response = await coordinator.get(
        `/api/audit-documents/${created.id}/files/${file.id}?disposition=${disposition}`,
      );
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers["x-evil"]).toBeUndefined();
      expect(headers["content-type"]).toBe(served);
      const value = headers["content-disposition"]!;
      expect(value).not.toMatch(/[\r\n]/);
      expect(value).toBe(
        `${disposition}; filename="documento-v1.${served === docxMime ? "docx" : "pdf"}"; filename*=UTF-8''${encodeURIComponent(expectedName)}`,
      );
    }
  }
});

test("arquivo de outro documento não abre pela URL deste", async ({
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
    const teamA = await unitId(coordinator, auditTeams.a);
    const a = await create(coordinator, teamA);
    const b = await create(coordinator, teamA);
    const crossed = await reviewer.get(
      `/api/audit-documents/${a.id}/files/${b.files[0]!.id}`,
    );
    expect(crossed.status()).toBe(404);
    for (const document of [a, b]) {
      expect(
        (await detail(reviewer, document.id)).events.filter(
          (event) => event.type === "read",
        ),
      ).toEqual([]);
      expect(
        await auditRows(admin, document.id, {
          action: "audit-document.file-viewed,audit-document.file-downloaded",
        }),
      ).toEqual([]);
    }
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("armazenamento é privado e a chave do objeto não sai da API", async ({
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
  const { client: sql } = createDatabase(e2eDatabaseUrl);
  const anonymous = await playwright.request.newContext();
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const created = await createDocument(
      coordinator,
      { unitId: teamA, title: unique("Armazenamento privado E2E") },
      docxFile(),
    );
    expect(created.status()).toBe(201);
    const document = await created.json();
    const [row] = await sql<
      { objectKey: string }[]
    >`select object_key as "objectKey" from audit_document_files where document_id = ${document.id}`;
    const key = row!.objectKey;
    expect(key).toMatch(/^audit-documents\/[0-9a-f-]{36}$/);

    const bodies = [
      await created.text(),
      await (await reviewer.get(`/api/audit-documents/${document.id}`)).text(),
      await (await reviewer.get("/api/audit-documents")).text(),
      await (await reviewer.get("/api/audit-documents/options")).text(),
    ];
    for (const body of bodies) {
      expect(body).not.toContain(key);
      expect(body).not.toMatch(/object_?key/i);
      expect(body).not.toContain("audit-documents/");
    }
    for (const path of ["/api/audit-documents", "/api/audit-documents/options"])
      expect((await reviewer.get(path)).headers()["cache-control"]).toBe(
        "no-store",
      );
    expect(
      (await reviewer.get(`/api/audit-documents/${document.id}`)).headers()[
        "cache-control"
      ],
    ).toBe("no-store");

    // Sem credenciais, o MinIO não entrega o objeto nem lista o prefixo.
    const bucket = `${e2eObjectStorageUrl}/intranet-cge-e2e`;
    for (const url of [
      `${bucket}/${key}`,
      `${bucket}?prefix=audit-documents/`,
    ]) {
      const response = await anonymous.get(url);
      expect(response.status()).toBe(403);
      expect(await response.text()).toContain("AccessDenied");
    }
  } finally {
    await Promise.all([
      ...clients.map((client) => client.dispose()),
      anonymous.dispose(),
      sql.end(),
    ]);
  }
});

test("leitura conta uma vez por pessoa e por versão", async ({
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
    const { id, files } = await create(coordinator, teamA);
    const open = (client: APIRequestContext, fileId: string) =>
      client.get(`/api/audit-documents/${id}/files/${fileId}`);
    const v1 = files[0]!.id;
    expect((await open(reviewer, v1)).status()).toBe(200);
    expect((await open(coordinator, v1)).status()).toBe(200);
    await transition(reviewer, id, {
      action: "request_correction",
      version: 1,
      message: "Nova versão, por favor.",
    });
    const v2 = (
      await (
        await uploadVersion(coordinator, id, { version: 2 }, pdfFile())
      ).json()
    ).files[1].id as string;
    expect((await open(reviewer, v2)).status()).toBe(200);
    expect((await open(reviewer, v1)).status()).toBe(200);

    const reads = (await detail(reviewer, id)).events
      .filter((event) => event.type === "read")
      .map((event) => `${event.actorAccountId}:${event.fileId}`)
      .sort();
    const reviewerId = (await (await reviewer.get("/api/auth/me")).json()).user
      .account.id;
    const coordinatorId = (await (await coordinator.get("/api/auth/me")).json())
      .user.account.id;
    expect(reads).toEqual(
      [
        `${reviewerId}:${v1}`,
        `${coordinatorId}:${v1}`,
        `${reviewerId}:${v2}`,
      ].sort(),
    );
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("metadados inválidos ou envio sem arquivo não criam documento", async ({
  playwright,
  baseURL,
}) => {
  const [coordinator] = (await signInAll(
    playwright,
    baseURL!,
    "coordinatorA",
  )) as [APIRequestContext];
  try {
    const teamA = await unitId(coordinator, auditTeams.a);
    const title = unique("Metadados inválidos E2E");
    const before = await titleCount(coordinator, "Metadados inválidos E2E");
    for (const metadata of [
      { unitId: teamA, title: "   " },
      { unitId: teamA },
      { unitId: "equipe-01", title },
      { unitId: teamA, title, status: "approved" },
    ])
      expect(
        (await createDocument(coordinator, metadata, docxFile())).status(),
      ).toBe(400);
    for (const multipart of [
      { metadata: JSON.stringify({ unitId: teamA, title }) },
      { metadata: "{nao é json", file: docxFile() },
      {
        metadata: JSON.stringify({ unitId: teamA, title }),
        other: "campo extra",
        file: docxFile(),
      },
      {
        metadata: JSON.stringify({ unitId: teamA, title }),
        file: docxFile(),
        other: "campo extra",
      },
      {
        metadata: JSON.stringify({ unitId: teamA, title }),
        file: docxFile(),
        second: docxFile("segundo.docx"),
      },
    ] as Record<string, string | ReturnType<typeof docxFile>>[])
      expect(
        (
          await coordinator.post("/api/audit-documents", { multipart })
        ).status(),
      ).toBe(400);
    expect(await titleCount(coordinator, "Metadados inválidos E2E")).toBe(
      before,
    );
  } finally {
    await coordinator.dispose();
  }
});
