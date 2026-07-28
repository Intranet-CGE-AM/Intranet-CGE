import { describe, expect, it } from "vitest";

import { assertHomologSeedEnvironment } from "./seed-homolog.js";

const valid = {
  DATABASE_URL: "postgresql://cge:cge@localhost:5432/intranet_cge_homolog",
  HOMOLOG_SEED_CONFIRM: "SEED_CGE_HOMOLOG",
  HOMOLOG_SEED_PASSWORD: "Homolog-Password-2026",
  NODE_ENV: "development",
};

describe("homolog seed guard", () => {
  it("accepts only an explicitly confirmed non-production homolog database", () => {
    expect(assertHomologSeedEnvironment(valid)).toEqual({
      databaseUrl: valid.DATABASE_URL,
      password: valid.HOMOLOG_SEED_PASSWORD,
    });
    expect(() =>
      assertHomologSeedEnvironment({
        ...valid,
        DATABASE_URL: "postgresql://cge:cge@localhost:5432/intranet_cge",
      }),
    ).toThrow(/Seed bloqueado/);
    expect(() =>
      assertHomologSeedEnvironment({ ...valid, NODE_ENV: "production" }),
    ).toThrow(/Seed bloqueado/);
  });
});
