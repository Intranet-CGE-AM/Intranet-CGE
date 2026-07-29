import { describe, expect, it } from "vitest";

import {
  anyPermissionAllows,
  permissionAllows,
  permissionAllowsGlobally,
  permissionSupportsUnitScope,
  type PermissionGrant,
} from "../src/access.js";

describe("permission policy", () => {
  const grants: PermissionGrant[] = [
    { key: "people.read", unitId: null },
    {
      key: "people.manage",
      unitId: "8ee687a3-b875-4d05-9b49-4a63058540f3",
    },
  ];

  it("applies global grants everywhere and scoped grants only in their unit", () => {
    expect(permissionAllows(grants, "people.read", "another-unit")).toBe(true);
    expect(
      permissionAllows(
        grants,
        "people.manage",
        "8ee687a3-b875-4d05-9b49-4a63058540f3",
      ),
    ).toBe(true);
    expect(permissionAllows(grants, "people.manage", "another-unit")).toBe(
      false,
    );
  });

  it("distinguishes any scoped access from organization-wide access", () => {
    expect(anyPermissionAllows(grants, ["people.manage"])).toBe(true);
    expect(permissionAllowsGlobally(grants, "people.manage")).toBe(false);
    expect(permissionAllowsGlobally(grants, "people.read")).toBe(true);
  });

  it("declares which permissions may be assigned by organizational unit", () => {
    expect(permissionSupportsUnitScope("people.manage")).toBe(true);
    expect(permissionSupportsUnitScope("vacations.review.final")).toBe(true);
    expect(permissionSupportsUnitScope("accounts.manage")).toBe(false);
    expect(permissionSupportsUnitScope("people.import")).toBe(false);
  });
});
