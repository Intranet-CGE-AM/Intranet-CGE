import { describe, expect, it } from "vitest";

import { createSessionToken, hashSessionToken } from "./token.js";

describe("session tokens", () => {
  it("creates high-entropy opaque tokens and stable hashes", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(first)).toHaveLength(64);
    expect(hashSessionToken(first)).toBe(hashSessionToken(first));
    expect(hashSessionToken(first)).not.toBe(hashSessionToken(second));
  });
});
