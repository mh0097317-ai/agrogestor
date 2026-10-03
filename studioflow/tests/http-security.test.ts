import test from "node:test";
import assert from "node:assert/strict";
import { assertSameOrigin, requestOrigin } from "../src/services/server-http";
test("CSRF usa host público mesmo com bind interno 0.0.0.0", () => {
  const request = new Request("http://0.0.0.0:3000/api/onboarding", {
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
  });
  assert.equal(requestOrigin(request), "http://localhost:3000");
  assert.doesNotThrow(() => assertSameOrigin(request));
  const external = new Request("http://0.0.0.0:3000/api/onboarding", {
    headers: { host: "localhost:3000", origin: "https://evil.example" },
  });
  assert.throws(() => assertSameOrigin(external), /Origem não autorizada/);
  const proxy = new Request("http://0.0.0.0:3000/api/onboarding", {
    headers: {
      host: "0.0.0.0:3000",
      "x-forwarded-host": "studioflow.example",
      "x-forwarded-proto": "https",
      origin: "https://studioflow.example",
    },
  });
  assert.doesNotThrow(() => assertSameOrigin(proxy));
});
