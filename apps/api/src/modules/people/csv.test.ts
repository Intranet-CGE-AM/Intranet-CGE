import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv.js";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and CRLF rows", () => {
    expect(
      parseCsv('matricula,nome\r\n123,"Silva, Ana"\r\n124,"João ""Jota"""'),
    ).toEqual([
      ["matricula", "nome"],
      ["123", "Silva, Ana"],
      ["124", 'João "Jota"'],
    ]);
  });

  it("rejects an unclosed quoted field", () => {
    expect(() => parseCsv('matricula,nome\n123,"Ana')).toThrow(
      "aspas não fechadas",
    );
  });
});
