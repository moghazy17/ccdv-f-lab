import { describe, expect, test } from "vitest";

import { embedJson } from "../../src/lib/embed";

describe("embedding build-time data in a script block", () => {
  test("leaves no raw < for the browser to end the script element on", () => {
    // An item discussing a closing script tag is ordinary content in a prompt-engineering bank.
    // Emitted raw, it would end the JSON block early and spill the rest of the payload as markup.
    const payload = { stem: "Wrap it in </script><img src=x onerror=alert(1)>" };

    const embedded = embedJson(payload);

    expect(embedded).not.toContain("<");
    expect(embedded).toContain(String.raw`\u003c`);
  });

  test("round-trips through JSON.parse unchanged, so nothing downstream has to know", () => {
    const payload = { a: "<b>", nested: { list: ["</script>", "plain"] }, n: 1 };

    expect(JSON.parse(embedJson(payload))).toEqual(payload);
  });
});
