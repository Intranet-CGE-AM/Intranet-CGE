import { describe, expect, it } from "vitest";

import { avatarObjectKey, validateAvatar } from "./avatar.js";

describe("avatar validation", () => {
  it("accepts matching raster signatures and rejects disguised content", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(validateAvatar(png, "image/png")).toBe("image/png");
    expect(() => validateAvatar(png, "image/jpeg")).toThrow("AVATAR_TYPE");
    expect(avatarObjectKey("person-id")).toBe("people/person-id/avatar");
  });
});
