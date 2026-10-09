import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createPlatformAuthClient,
  platformCookieName,
  signInPlatform,
} from "../src/lib/supabase/platform-auth";

test("admin password login uses an independent server-only session and rejects ordinary accounts", async () => {
  const cookieJar = new Map<string, string>();
  const writes: { name: string; options: CookieOptions }[] = [];
  const logouts: string[] = [];
  const cookies = {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    setAll: (
      values: { name: string; value: string; options: CookieOptions }[],
    ) => {
      values.forEach(({ name, value, options }) => {
        writes.push({ name, options });
        if (options.maxAge === 0) cookieJar.delete(name);
        else cookieJar.set(name, value);
      });
    },
  };
  const user = (id: string) => ({
    id,
    aud: "authenticated",
    role: "authenticated",
    email: `${id}@example.test`,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  });
  const jwt = (id: string) =>
    [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url"),
      "signature",
    ].join(".");
  const server = createServer(async (request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (request.url?.startsWith("/auth/v1/token")) {
      let body = "";
      for await (const chunk of request) body += chunk;
      const input = JSON.parse(body);
      if (input.password !== "local-test-password") {
        response.writeHead(400);
        response.end(
          JSON.stringify({
            code: "invalid_credentials",
            msg: "Invalid login credentials",
          }),
        );
        return;
      }
      const id = input.email.startsWith("admin") ? "admin" : "business";
      response.end(
        JSON.stringify({
          access_token: jwt(id),
          refresh_token: `refresh-${id}`,
          token_type: "bearer",
          expires_in: 3600,
          user: user(id),
        }),
      );
    } else if (request.url === "/auth/v1/user") {
      const token = request.headers.authorization?.slice(7) || "";
      const id = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      ).sub;
      response.end(JSON.stringify(user(id)));
    } else if (request.url?.startsWith("/auth/v1/logout")) {
      logouts.push(request.url);
      response.writeHead(204);
      response.end();
    } else {
      response.writeHead(404);
      response.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const business = createServerClient(url, "local-test-public-key", {
      cookies,
    });
    await business.auth.signInWithPassword({
      email: "business@example.test",
      password: "local-test-password",
    });
    const businessCookies = [...cookieJar];
    const admin = createPlatformAuthClient(
      url,
      "local-test-public-key",
      cookies,
    );
    assert.equal(
      (await admin.auth.getUser()).data.user,
      null,
      "a business login must not grant an admin session",
    );
    let checked = false;
    await assert.rejects(
      signInPlatform(
        admin,
        { email: "admin@example.test", password: "wrong" },
        async () => {
          checked = true;
          return true;
        },
      ),
      /Confira seus dados/,
    );
    assert.equal(checked, false);
    await assert.rejects(
      signInPlatform(
        admin,
        { email: "business@example.test", password: "local-test-password" },
        async (id) => id === "admin",
      ),
      /Confira seus dados/,
    );
    assert.deepEqual([...cookieJar], businessCookies);
    assert.deepEqual(logouts, ["/auth/v1/logout?scope=local"]);
    await signInPlatform(
      admin,
      { email: "admin@example.test", password: "local-test-password" },
      async (id) => id === "admin",
    );
    assert.equal(
      (
        await createPlatformAuthClient(
          url,
          "local-test-public-key",
          cookies,
        ).auth.getUser()
      ).data.user?.id,
      "admin",
    );
    assert.equal(
      (
        await createServerClient(url, "local-test-public-key", {
          cookies,
        }).auth.getUser()
      ).data.user?.id,
      "business",
    );
    assert.ok(
      writes.some(
        (row) =>
          row.name.startsWith(platformCookieName) &&
          row.options.httpOnly === true &&
          row.options.sameSite === "lax",
      ),
    );
    await admin.auth.signOut({ scope: "local" });
    assert.deepEqual(
      [...cookieJar],
      businessCookies,
      "admin logout must preserve the business login",
    );
    assert.equal(
      (
        await createPlatformAuthClient(
          url,
          "local-test-public-key",
          cookies,
        ).auth.getUser()
      ).data.user,
      null,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
