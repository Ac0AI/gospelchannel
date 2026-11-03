// Small text helpers for search: diacritic-insensitive normalization and a
// typo distance. Shared by query understanding and place resolution.

/** Lowercase, strip diacritics (ö → o, é → e, ß → ss) and collapse whitespace. */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words of a folded string, keeping hyphenated words ("non-denominational") whole. */
export function tokenize(value: string): string[] {
  return foldText(value)
    .split(" ")
    .map((token) => token.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

/** Words as the user typed them (lowercased, diacritics kept), aligned one-to-one with tokenize(). */
export function tokenizeOriginal(value: string): string[] {
  const original = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^['-]+|['-]+$/g, ""))
    .filter((token) => foldText(token).length > 0);
  return original.length === tokenize(value).length ? original : tokenize(value);
}

/** Damerau-Levenshtein (optimal string alignment): a swap of two letters counts as one edit. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many typos a word of this length may carry and still count as a match. */
export function allowedTypos(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

/** True when `token` is `target` with at most the allowed number of typos. */
export function isTypoOf(token: string, target: string): boolean {
  if (token === target) return true;
  const allowed = allowedTypos(Math.min(token.length, target.length));
  if (allowed === 0 || Math.abs(token.length - target.length) > allowed) return false;
  return editDistance(token, target) <= allowed;
}
