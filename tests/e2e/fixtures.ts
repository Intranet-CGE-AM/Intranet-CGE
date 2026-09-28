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

type Tuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? R
  : Tuple<T, N, [...R, T]>;

// Narrows an array to a fixed-length tuple (checked at runtime), so
// destructuring does not yield `T | undefined` under noUncheckedIndexedAccess.
export function tuple<T, N extends number>(
  items: readonly T[],
  length: N,
): Tuple<T, N> {
  if (items.length !== length) {
    throw new Error(`Expected ${length} items, got ${items.length}`);
  }
  return items as unknown as Tuple<T, N>;
}

// Indexed access that fails loudly instead of yielding `T | undefined`.
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`No item at index ${index}`);
  }
  return item;
}

// Shape of `user` in the /api/auth/login response, as far as the specs read it.
export type E2EUser = {
  account: { id: string };
  person: { id: string; displayName: string };
  employment: {
    id: string;
    unit: { id: string; name: string };
    category: { id: string };
  };
};
