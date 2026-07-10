/**
 * Serialize a value for embedding inside <script type="application/ld+json">.
 * JSON.stringify alone is unsafe there: it does not escape "<", so a value
 * containing "</script>" closes the tag and injects HTML. Escaping "<" as
 * the JSON unicode escape neutralizes the breakout. U+2028/U+2029 line/
 * paragraph separators are escaped for JS-context safety as well, since they
 * are valid in JSON strings but are line terminators in JS source text.
 */
export function serializeJsonLd(value: unknown): string {
  const LINE_SEPARATOR = String.fromCharCode(0x2028);
  const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
  return JSON.stringify(value)
    .split("<").join("\\u003c")
    .split(LINE_SEPARATOR).join("\\u2028")
    .split(PARAGRAPH_SEPARATOR).join("\\u2029");
}
