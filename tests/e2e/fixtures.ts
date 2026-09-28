import { randomBytes } from "node:crypto";
import { test as base } from "@playwright/test";

export * from "@playwright/test";

export function clientHeaders() {
  // Each simulated client keeps its own rate-limit bucket; production limits remain unchanged.
  const groups = randomBytes(12).toString("hex").match(/.{4}/g)!;
  return {
    Origin: "http://127.0.0.1:4173",
    "X-Forwarded-For": `fd00:0:${groups.join(":")}`,
  };
}

export const test = base.extend({
  extraHTTPHeaders: async ({ baseURL }, use) => {
    await use({
      ...clientHeaders(),
      Origin: baseURL ?? "http://127.0.0.1:4173",
    });
  },
});
