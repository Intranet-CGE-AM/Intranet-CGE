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

const adEnvironment = {
  AD_ENABLED: "true",
  AD_URL: "ldaps://CGE-DC01.cge.lan:636",
  AD_DOMAIN: "cge.lan",
  AD_BASE_DN: "OU=CGE,DC=cge,DC=lan",
  AD_BIND_DN: "reader@cge.lan",
  AD_BIND_PASSWORD_FILE: "/run/secrets/ad-password",
  AD_CA_CERT_FILE: "/run/secrets/ad-ca.pem",
};
describe("AD configuration", () => {
  it("is disabled by default and requires complete settings when enabled", () => {
    expect(loadConfig({}).directory).toBeUndefined();
    expect(() => loadConfig({ AD_ENABLED: "true" })).toThrow();
    expect(loadConfig(adEnvironment).directory?.AD_RECHECK_SECONDS).toBe(300);
  });
  it.each([
    "ldap://dc.cge.lan",
    "ldaps://10.0.0.7",
    "ldaps://user:secret@dc.cge.lan",
    "ldaps://dc.cge.lan/path",
    "https://dc.cge.lan",
  ])("rejects unsafe directory endpoints %s", (AD_URL) => {
    expect(() => loadConfig({ ...adEnvironment, AD_URL })).toThrow();
  });
  it("does not permit unbounded revocation delay", () => {
    expect(() =>
      loadConfig({ ...adEnvironment, AD_RECHECK_SECONDS: "301" }),
    ).toThrow();
  });
});
