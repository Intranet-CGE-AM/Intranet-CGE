import { describe, expect, it } from "vitest";

import { canCancelVacation, decisionStatus } from "./state.js";

describe("vacation state rules", () => {
  it("maps both decision stages and limits cancellation to open requests", () => {
    expect(decisionStatus("supervisor", "approve")).toBe("supervisor_approved");
    expect(decisionStatus("final", "reject")).toBe("final_rejected");
    expect(canCancelVacation("supervisor_approved")).toBe(true);
    expect(canCancelVacation("final_approved")).toBe(false);
    expect(canCancelVacation("supervisor_rejected")).toBe(false);
  });
});
