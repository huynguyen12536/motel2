import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import * as client from "@/lib/api/client";
import { token } from "@/lib/auth/token";
import { ApiError } from "@/lib/api/api-error";

test.describe("HTTP authentication infrastructure", () => {
  test.describe.configure({ mode: "serial" });
  let server: Server;
  let refreshCalls = 0;
  let refreshFails = false;
  let resourceRejects = false;

  test.beforeAll(async () => {
    server = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      const reply = (status: number, data: object) => {
        response.statusCode = status;
        response.end(JSON.stringify(data));
      };
      if (request.url === "/auth/refresh") {
        refreshCalls++;
        setTimeout(
          () =>
            refreshFails
              ? reply(401, { message: "Session expired", code: "EXPIRED" })
              : reply(200, { accessToken: "fresh-token" }),
          60,
        );
      } else if (request.url === "/auth/login")
        reply(401, { message: "Invalid credentials" });
      else if (request.url === "/validation")
        reply(422, {
          message: "Invalid fields",
          code: "VALIDATION",
          errors: { email: ["Already used"] },
        });
      else if (
        !resourceRejects &&
        request.headers.authorization === "Bearer fresh-token"
      )
        reply(200, { ok: true });
      else reply(401, { message: "Expired access token" });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(18881, "127.0.0.1", resolve);
    });
  });
  test.beforeEach(() => {
    token.clear();
    token.set("old-token");
    refreshCalls = 0;
    refreshFails = false;
    resourceRejects = false;
  });
  test.afterAll(async () => {
    token.clear();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  test("parallel 401s share one refresh and retry with the new token", async () => {
    const results = await Promise.all([
      client.apiClient.get("/users"),
      client.apiClient.get("/settings"),
      client.apiClient.get("/auth/me"),
    ]);
    expect(results.every((result) => result.data.ok)).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(token.get()).toBe("fresh-token");
  });
  test("login errors never cause refresh and validation errors are normalized", async () => {
    await expect(client.apiClient.post("/auth/login")).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshCalls).toBe(0);
    await expect(client.apiClient.post("/validation")).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION",
      errors: { email: ["Already used"] },
    });
  });
  test("failed refresh clears the token without looping", async () => {
    refreshFails = true;
    await expect(client.apiClient.get("/users")).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(refreshCalls).toBe(1);
    expect(token.get()).toBeNull();
  });
  test("a repeated 401 after refresh stops after one retry", async () => {
    resourceRejects = true;
    await expect(client.apiClient.get("/users")).rejects.toMatchObject({
      status: 401,
    });
    expect(refreshCalls).toBe(1);
    expect(token.get()).toBeNull();
  });
  test("logout during refresh cannot restore an old session", async () => {
    const pending = client.refreshAccessToken();
    token.clear();
    await expect(pending).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(token.get()).toBeNull();
  });
});
