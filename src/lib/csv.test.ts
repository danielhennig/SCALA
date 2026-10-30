import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

const BOM = String.fromCharCode(0xfeff);

describe("toCsv", () => {
  it("starts with a BOM and uses ; and CRLF", () => {
    const csv = toCsv([
      ["Data", "Pessoa"],
      ["10/01/2030", "João"],
    ]);
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(
      new Uint8Array([0xef, 0xbb, 0xbf]),
    );
    expect(csv).toBe(`${BOM}Data;Pessoa\r\n10/01/2030;João\r\n`);
  });

  it("quotes cells with separators, quotes or line breaks", () => {
    expect(toCsv([['UTI; Ala "B"', "linha 1\nlinha 2", "a,b"]])).toBe(
      `${BOM}"UTI; Ala ""B""";"linha 1\nlinha 2";a,b\r\n`,
    );
  });

  it("neutralizes values a spreadsheet would run as formulas", () => {
    expect(toCsv([['=HYPERLINK("x")', "+1", "-2", "@SUM(A1)", "Ana"]])).toBe(
      `${BOM}"'=HYPERLINK(""x"")";'+1;'-2;'@SUM(A1);Ana\r\n`,
    );
  });

  it("returns only the BOM for no rows", () => {
    expect(toCsv([])).toBe(BOM);
  });
});
