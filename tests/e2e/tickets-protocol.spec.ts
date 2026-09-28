import type { TicketCategory, TicketSummary } from "@cge/contracts";

import { at, clientHeaders, expect, test } from "./fixtures";

const protocolFormat = /^\d{8}-\d{4}$/;

test("chamados abertos no dia do seed recebem protocolos distintos e no formato canônico", async ({
  baseURL,
  playwright,
}) => {
  const origin = baseURL ?? "http://127.0.0.1:4173";
  const context = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { ...clientHeaders(), Origin: origin },
  });
  try {
    await context.post("/api/auth/login", {
      data: {
        email: "caio.nascimento@homolog.cge.am.gov.br",
        password: "Homolog-Password-2026",
      },
    });

    const { categories } = (await (
      await context.get("/api/tickets/categories")
    ).json()) as { categories: TicketCategory[] };
    const hardware = categories.find((c) => c.code === "HARDWARE");
    expect(hardware).toBeDefined();
    const subcategory = at(hardware!.subcategories, 0);

    const created: string[] = [];
    for (const description of ["Primeiro chamado", "Segundo chamado"]) {
      const response = await context.post("/api/tickets", {
        data: {
          categoryId: hardware!.id,
          subcategoryId: subcategory.id,
          freeTextDescription: description,
        },
      });
      expect(response.status()).toBe(201);
      created.push(((await response.json()) as TicketSummary).ticketNumber);
    }

    const { tickets } = (await (
      await context.get("/api/tickets/my")
    ).json()) as {
      tickets: TicketSummary[];
    };
    const numbers = tickets.map((t) => t.ticketNumber);

    for (const number of numbers) {
      expect(number).toMatch(protocolFormat);
    }
    expect(numbers).toEqual(expect.arrayContaining(created));
    expect(new Set(numbers).size).toBe(numbers.length);
  } finally {
    await context.dispose();
  }
});
