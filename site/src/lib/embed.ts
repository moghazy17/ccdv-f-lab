/**
 * Serialise build-time data for a `<script type="application/json">` block.
 *
 * A script element's content is raw text: the browser ends it at the first closing script tag,
 * wherever that appears, including inside what was meant to be a JSON string. `JSON.stringify`
 * escapes quotes and backslashes but leaves `<` alone, so an item that legitimately discusses a
 * closing script tag — hardly unlikely in a bank about prompt engineering — would truncate the
 * payload and spill the remainder of the page's data into the document as markup.
 *
 * Escaping every `<` to its unicode form settles it. The result is still valid JSON and
 * `JSON.parse` returns the original string unchanged, so nothing downstream has to know.
 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", String.raw`\u003c`);
}
