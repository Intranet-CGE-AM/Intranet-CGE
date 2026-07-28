import { describe, expect, it } from "vitest";

import { birthdayDistance, dateInManaus } from "./birthdays.js";

describe("birthday dates", () => {
  it("uses the Manaus calendar day at a UTC boundary", () => {
    expect(dateInManaus(new Date("2026-07-29T02:30:00.000Z"))).toBe(
      "2026-07-28",
    );
  });

  it("counts today, the next year and leap-day birthdays", () => {
    expect(birthdayDistance("1990-07-28", "2026-07-28")).toBe(0);
    expect(birthdayDistance("1990-07-27", "2026-07-28")).toBe(364);
    expect(birthdayDistance("1992-02-29", "2027-02-27")).toBe(1);
  });
});
