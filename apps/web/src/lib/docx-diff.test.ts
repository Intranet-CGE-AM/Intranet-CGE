// @vitest-environment happy-dom
import { Document, Packer, Paragraph } from "docx";
import { describe, expect, it } from "vitest";
import {
  collapse,
  countChanges,
  diffLines,
  docxToLines,
  extractLines,
} from "./docx-diff";

describe("diffLines", () => {
  it("1. identical inputs give only equal rows and zero counters", () => {
    const rows = diffLines(["A", "B"], ["A", "B"]);
    expect(rows.map((r) => r.kind)).toEqual(["equal", "equal"]);
    expect(countChanges(rows)).toEqual({ added: 0, removed: 0 });
  });

  it("2. paragraph added in the middle gives one added row and shifted line numbers", () => {
    const rows = diffLines(["A", "C"], ["A", "B", "C"]);
    expect(rows).toEqual([
      { kind: "equal", baseLine: 1, nextLine: 1, baseText: "A", nextText: "A" },
      { kind: "added", baseLine: null, nextLine: 2, nextText: "B" },
      { kind: "equal", baseLine: 2, nextLine: 3, baseText: "C", nextText: "C" },
    ]);
    expect(countChanges(rows)).toEqual({ added: 1, removed: 0 });
  });

  it("3. paragraph removed gives one removed row", () => {
    const rows = diffLines(["A", "B", "C"], ["A", "C"]);
    expect(rows).toEqual([
      { kind: "equal", baseLine: 1, nextLine: 1, baseText: "A", nextText: "A" },
      { kind: "removed", baseLine: 2, nextLine: null, baseText: "B" },
      { kind: "equal", baseLine: 3, nextLine: 2, baseText: "C", nextText: "C" },
    ]);
    expect(countChanges(rows)).toEqual({ added: 0, removed: 1 });
  });

  it("4. one word changed gives a modified row with word segments", () => {
    const rows = diffLines(["O prazo é de 10 dias"], ["O prazo é de 15 dias"]);
    expect(rows).toEqual([
      {
        kind: "modified",
        baseLine: 1,
        nextLine: 1,
        baseText: "O prazo é de 10 dias",
        nextText: "O prazo é de 15 dias",
        segments: [
          { text: "O prazo é de ", kind: "equal" },
          { text: "10", kind: "removed" },
          { text: "15", kind: "added" },
          { text: " dias", kind: "equal" },
        ],
      },
    ]);
    expect(countChanges(rows)).toEqual({ added: 1, removed: 1 });
  });

  it("5. table row with a changed cell is modified", () => {
    const rows = diffLines(["Falha | Médio"], ["Falha | Alto"]);
    expect(rows[0]).toMatchObject({
      kind: "modified",
      baseText: "Falha | Médio",
      nextText: "Falha | Alto",
      segments: [
        { text: "Falha | ", kind: "equal" },
        { text: "Médio", kind: "removed" },
        { text: "Alto", kind: "added" },
      ],
    });
  });

  it("7. unequal blocks (2 removed, 3 added) give 2 modified and 1 added", () => {
    const rows = diffLines(
      ["A", "x1", "x2", "Z"],
      ["A", "y1", "y2", "y3", "Z"],
    );
    expect(rows.map((r) => [r.kind, r.baseLine, r.nextLine])).toEqual([
      ["equal", 1, 1],
      ["modified", 2, 2],
      ["modified", 3, 3],
      ["added", null, 4],
      ["equal", 4, 5],
    ]);
    expect(countChanges(rows)).toEqual({ added: 3, removed: 2 });
  });
});

describe("extractLines", () => {
  it("6. headings, list items and table rows become lines; images and empty paragraphs do not", () => {
    const html = `
      <h1>Título</h1>
      <p>  Texto   com
      espaços </p>
      <p></p>
      <p><img src="x.png" /></p>
      <p>&nbsp;</p>
      <ul><li>Item um</li><li><p>Item dois</p></li></ul>
      <table><tbody>
        <tr><td><p>Falha</p></td><td><p>Médio</p></td></tr>
      </tbody></table>`;
    expect(extractLines(html)).toEqual([
      "Título",
      "Texto com espaços",
      "Item um",
      "Item dois",
      "Falha | Médio",
    ]);
  });
});

describe("collapse", () => {
  const equal = (n: number) => Array.from({ length: n }, (_, i) => `L${i + 1}`);

  it("8a. hides a 20-line equal run between changes leaving 3+3 context and 14 hidden", () => {
    const base = ["a", ...equal(20), "z"];
    const next = ["A", ...equal(20), "Z"];
    const items = collapse(diffLines(base, next));
    expect(
      items.map((i) => ("hidden" in i ? `hidden:${i.count}` : i.kind)),
    ).toEqual([
      "modified",
      "equal",
      "equal",
      "equal",
      "hidden:14",
      "equal",
      "equal",
      "equal",
      "modified",
    ]);
    const group = items.find((i) => "hidden" in i);
    expect(
      group && "hidden" in group && group.hidden.map((r) => r.baseText),
    ).toEqual(equal(20).slice(3, 17));
  });

  it("8b. a 6-line equal run is not collapsed", () => {
    const items = collapse(
      diffLines(["a", ...equal(6), "z"], ["A", ...equal(6), "Z"]),
    );
    expect(items).toHaveLength(8);
    expect(items.some((i) => "hidden" in i)).toBe(false);
  });

  it("8c. at the document edges only the side touching a change keeps context", () => {
    const items = collapse(diffLines([...equal(20), "z"], [...equal(20), "Z"]));
    expect(
      items.map((i) => ("hidden" in i ? `hidden:${i.count}` : i.kind)),
    ).toEqual(["hidden:17", "equal", "equal", "equal", "modified"]);
  });
});

describe("docxToLines", () => {
  it("reads the paragraphs of a Word file", async () => {
    const file = new Document({
      sections: [{ children: [new Paragraph("Um"), new Paragraph("Dois")] }],
    });
    const buffer = await Packer.toBuffer(file);
    const ab = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    expect(await docxToLines(ab)).toEqual(["Um", "Dois"]);
  });
});
