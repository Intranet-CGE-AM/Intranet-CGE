import { describe, expect, it } from "vitest";

import { permissionAllows } from "./service.js";

describe("permissionAllows", () => {
  const grants = [
    { key: "people.read" as const, unitId: null },
    {
      key: "vacations.review.supervisor" as const,
      unitId: "8ee687a3-b875-4d05-9b49-4a63058540f3",
    },
  ];

  it("applies global grants everywhere and scoped grants only in their unit", () => {
    expect(permissionAllows(grants, "people.read", "another-unit")).toBe(true);
    expect(
      permissionAllows(
        grants,
        "vacations.review.supervisor",
        "8ee687a3-b875-4d05-9b49-4a63058540f3",
      ),
    ).toBe(true);
    expect(
      permissionAllows(grants, "vacations.review.supervisor", "another-unit"),
    ).toBe(false);
  });
});
