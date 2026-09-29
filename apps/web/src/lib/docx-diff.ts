import { diffArrays, diffWordsWithSpace } from "diff";
import mammoth from "mammoth";

export type Segment = { text: string; kind: "equal" | "added" | "removed" };

export type DiffRow = {
  kind: "equal" | "added" | "removed" | "modified";
  baseLine: number | null;
  nextLine: number | null;
  /** Base text (equal, removed, modified). */
  baseText?: string;
  /** Next text (equal, added, modified). */
  nextText?: string;
  /** Word segments, only for modified rows. */
  segments?: Segment[];
};

export function diffLines(base: string[], next: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let b = 0;
  let n = 0;
  const parts = diffArrays(base, next);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (!part.added && !part.removed) {
      for (const text of part.value) {
        rows.push({
          kind: "equal",
          baseLine: ++b,
          nextLine: ++n,
          baseText: text,
          nextText: text,
        });
      }
      continue;
    }
    // jsdiff emits the removed block right before the added one.
    const removed = part.removed ? part.value : [];
    const followed = part.removed ? parts[i + 1] : undefined;
    const added = part.added
      ? part.value
      : followed?.added
        ? followed.value
        : [];
    if (followed?.added) i++;
    const paired = Math.min(removed.length, added.length);
    for (let k = 0; k < paired; k++) {
      const baseText = removed[k]!;
      const nextText = added[k]!;
      rows.push({
        kind: "modified",
        baseLine: ++b,
        nextLine: ++n,
        baseText,
        nextText,
        segments: diffWordsWithSpace(baseText, nextText).map((w) => ({
          text: w.value,
          kind: w.added ? "added" : w.removed ? "removed" : "equal",
        })),
      });
    }
    for (const baseText of removed.slice(paired)) {
      rows.push({ kind: "removed", baseLine: ++b, nextLine: null, baseText });
    }
    for (const nextText of added.slice(paired)) {
      rows.push({ kind: "added", baseLine: null, nextLine: ++n, nextText });
    }
  }
  return rows;
}

/** A modified line counts as one addition and one deletion, like GitHub. */
export function countChanges(rows: DiffRow[]) {
  return {
    added: rows.filter((r) => r.kind === "added" || r.kind === "modified")
      .length,
    removed: rows.filter((r) => r.kind === "removed" || r.kind === "modified")
      .length,
  };
}

const clean = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

/** One comparable line per block of the Word HTML (mammoth output). */
export function extractLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const lines: string[] = [];
  for (const el of doc.body.querySelectorAll(
    "tr, p, h1, h2, h3, h4, h5, h6, li",
  )) {
    const tag = el.tagName;
    if (tag === "TR") {
      const cells = [...el.children].map((cell) => clean(cell.textContent));
      lines.push(cells.join(" | "));
    } else if (
      el.closest("td, th") ||
      (tag === "P" && el.parentElement?.tagName === "LI")
    ) {
      continue; // covered by the row or the list item
    } else if (tag === "LI") {
      const own = el.cloneNode(true) as Element;
      own.querySelectorAll("ul, ol").forEach((nested) => nested.remove());
      lines.push(clean(own.textContent));
    } else {
      lines.push(clean(el.textContent));
    }
  }
  return lines.filter((line) => line.replace(/\|/g, "").trim() !== "");
}

export type CollapsedItem = DiffRow | { hidden: DiffRow[]; count: number };

/** Hides long runs of unchanged rows, keeping `context` rows next to changes. */
export function collapse(
  rows: DiffRow[],
  context = 3,
  min = 8,
): CollapsedItem[] {
  const items: CollapsedItem[] = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i]!.kind !== "equal") {
      items.push(rows[i++]!);
      continue;
    }
    let end = i;
    while (end < rows.length && rows[end]!.kind === "equal") end++;
    const run = rows.slice(i, end);
    if (run.length <= min) {
      items.push(...run);
    } else {
      const head = i > 0 ? context : 0;
      const tail = end < rows.length ? context : 0;
      const hidden = run.slice(head, run.length - tail);
      items.push(
        ...run.slice(0, head),
        { hidden, count: hidden.length },
        ...run.slice(run.length - tail),
      );
    }
    i = end;
  }
  return items;
}

/** Word file -> comparable lines. Images are dropped, only text is compared. */
export async function docxToLines(arrayBuffer: ArrayBuffer) {
  const result = await mammoth.convertToHtml(
    // The browser build reads arrayBuffer; the Node build (unit tests) reads buffer.
    { arrayBuffer, buffer: arrayBuffer } as { arrayBuffer: ArrayBuffer },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );
  return extractLines(result.value);
}
