import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("SECURE_COOKIES", () => {
  it("exige HTTPS em produção quando não declarado", () => {
    expect(loadConfig({ NODE_ENV: "production" }).SECURE_COOKIES).toBe(true);
  });

  // Sem isso o desenvolvimento local e a suíte e2e rodam sobre http com o
  // cookie marcado Secure: o navegador descarta a sessão e todo pedido
  // autenticado falha.
  it("não exige HTTPS fora de produção quando não declarado", () => {
    expect(loadConfig({ NODE_ENV: "development" }).SECURE_COOKIES).toBe(false);
    expect(loadConfig({ NODE_ENV: "test" }).SECURE_COOKIES).toBe(false);
  });

  it("aceita declaração explícita nos dois sentidos", () => {
    expect(
      loadConfig({ NODE_ENV: "development", SECURE_COOKIES: "true" })
        .SECURE_COOKIES,
    ).toBe(true);
    // É assim que homologação roda: comportamento de produção, sem TLS.
    expect(
      loadConfig({ NODE_ENV: "production", SECURE_COOKIES: "false" })
        .SECURE_COOKIES,
    ).toBe(false);
  });
});
