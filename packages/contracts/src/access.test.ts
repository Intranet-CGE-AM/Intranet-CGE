import { describe, expect, it } from "vitest";

import {
  permissionAllows,
  permissionAllowsGlobally,
  permissionUnitIds,
  type PermissionGrant,
} from "./access.js";

describe("permission overrides", () => {
  it("lets an individual deny take precedence over role grants", () => {
    const grants: PermissionGrant[] = [
      { effect: "allow", key: "people.read", unitId: null },
      { effect: "deny", key: "people.read", unitId: null },
    ];

    expect(permissionAllows(grants, "people.read")).toBe(false);
    expect(permissionAllowsGlobally(grants, "people.read")).toBe(false);
    expect(permissionUnitIds(grants, "people.read")).toEqual([]);
  });

  it("keeps an individual unit grant inside that unit", () => {
    const grants: PermissionGrant[] = [
      {
        effect: "allow",
        key: "people.read",
        unitId: "00000000-0000-4000-8000-000000000001",
      },
    ];

    expect(
      permissionAllows(
        grants,
        "people.read",
        "00000000-0000-4000-8000-000000000001",
      ),
    ).toBe(true);
    expect(
      permissionAllows(
        grants,
        "people.read",
        "00000000-0000-4000-8000-000000000002",
      ),
    ).toBe(false);
    expect(permissionUnitIds(grants, "people.read")).toEqual([
      "00000000-0000-4000-8000-000000000001",
    ]);
  });
});
