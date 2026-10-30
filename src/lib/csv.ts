// CSV meant to be opened in a spreadsheet (RFC 4180 quoting, CRLF rows).
// Excel in pt-BR expects ";" as the separator (the comma is the decimal
// separator) and needs the UTF-8 BOM to read accents correctly.

const SEPARATOR = ";";
const BOM = String.fromCharCode(0xfeff);

/**
 * Cells starting with = + - @ (or tab/CR) are run as formulas by spreadsheet
 * apps ("CSV injection"). Names come from users, so prefix those with an
 * apostrophe, which makes the spreadsheet treat the cell as text.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: string): string {
  const safe = neutralizeFormula(value);
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return (
    BOM + rows.map((row) => row.map(cell).join(SEPARATOR) + "\r\n").join("")
  );
}
