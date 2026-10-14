import { describe, expect, it } from "vitest";

import { transitionNote } from "./service.js";

describe("transitionNote", () => {
  it("describes the new status with its Portuguese label", () => {
    expect(transitionNote("viewed")).toBe("Status alterado para visualizado.");
    expect(transitionNote("in_service")).toBe(
      "Status alterado para em atendimento.",
    );
    expect(transitionNote("en_route")).toBe("Status alterado para a caminho.");
  });

  it("keeps a note written by the actor", () => {
    expect(transitionNote("completed", "  Resolvido no local  ")).toBe(
      "Resolvido no local",
    );
  });
});
