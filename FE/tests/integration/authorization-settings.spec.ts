import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
test.describe.configure({ mode: "serial" });
test.setTimeout(90000);
test.use({ trace: "off", video: "off" });
test.skip(
  !process.env.AUTHZ_E2E_API,
  "Requires the owned-database authorization runner, never demo data",
);
const base = process.env.E2E_BASE_URL!,
  apiOrigin = process.env.AUTHZ_E2E_API!,
  email = process.env.AUTHZ_E2E_EMAIL!,
  password = process.env.AUTHZ_E2E_PASSWORD!,
  tag = randomBytes(5).toString("hex");
let context: BrowserContext, page: Page, token: string;
async function api(
  path: string,
  method = "GET",
  body?: unknown,
  bearer = token,
) {
  const r = await fetch(apiOrigin + "/api/v1" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: "Bearer " + bearer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json() };
}
async function platformLogin(p: Page, mail = email, pw = password) {
  await p.goto("/auth/platform-sign-in");
  await p.getByLabel("Email", { exact: true }).fill(mail);
  await p.getByLabel("Password", { exact: true }).fill(pw);
  const response = p.waitForResponse((r) =>
    r.url().endsWith("/api/session/login"),
  );
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(p).toHaveURL(/\/settings$/, { timeout: 45000 });
}
test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies([{ name: "locale", value: "en", url: base }]);
  page = await context.newPage();
  const pair = await api(
    "/platform/auth/login",
    "POST",
    { email, password },
    "",
  );
  expect(pair.status).toBe(200);
  token = pair.body.accessToken;
  await platformLogin(page);
});
test.afterAll(async () => {
  await context?.close();
});
test("platform login loads authoritative Settings navigation and keeps refresh credentials HttpOnly", async () => {
  const nav = page.getByRole("navigation", { name: "Settings navigation" });
  await expect(
    nav.getByRole("link", { name: "Tenant Management", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Roles & Permissions", exact: true }),
  ).toBeVisible();
  const cookies = await context.cookies(base + "/api/session");
  expect(cookies.find((c) => c.name === "motel-refresh")?.httpOnly).toBe(true);
  expect(
    await page.evaluate(() => sessionStorage.getItem("wms-demo-token")),
  ).toBeNull();
  const csrf = await context.request.post("/api/session/refresh", {
    headers: { Origin: "https://untrusted.invalid" },
  });
  expect(csrf.status()).toBe(403);
});
test("role editor and real catalog matrix save persistent exact permissions", async () => {
  await page.goto("/settings/roles");
  await page.getByRole("button", { name: "Create role", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Code", { exact: true })
    .fill("UI_" + tag.toUpperCase());
  await dialog.getByLabel("Name", { exact: true }).fill("UI role " + tag);
  await dialog
    .getByLabel("Description", { exact: true })
    .fill("Created through Settings");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "UI role " + tag });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Permissions", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "platform.tenants:read", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save permissions", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const result = await api(
    "/platform/roles?search=" + encodeURIComponent("UI_" + tag.toUpperCase()),
  );
  expect(result.status).toBe(200);
  expect(result.body.items[0].permissionCodes).toEqual([
    "platform.tenants:read",
  ]);
});
test("user creation and reviewed role assignment use the protected APIs", async () => {
  await page.goto("/settings/users");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  const dialog = page.getByRole("dialog"),
    mail = "ui-" + tag + "@test.invalid";
  await dialog.getByLabel("Name", { exact: true }).fill("UI member");
  await dialog.getByLabel("Email", { exact: true }).fill(mail);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill(process.env.AUTHZ_E2E_READER_PASSWORD!);
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("textbox", { name: "Search users by email" }).fill(mail);
  const row = page.getByRole("row").filter({ hasText: mail });
  await row.getByRole("button", { name: "Assign roles", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "UI role " + tag, exact: true })
    .check();
  await page
    .getByRole("button", { name: "Review role changes", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(row).toContainText("UI role " + tag);
});
test("tenant registration stays pending and provisioning 202 is shown as acceptance, not completion", async () => {
  await page.goto("/settings/tenants");
  await page
    .getByRole("button", { name: "Create tenant", exact: true })
    .click();
  const dialog = page.getByRole("dialog"),
    name = "UI company " + tag;
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog
    .getByLabel("Code", { exact: true })
    .fill("UI_COMPANY_" + tag.toUpperCase());
  await dialog.getByLabel("Slug", { exact: true }).fill("ui-company-" + tag);
  await dialog
    .getByRole("button", { name: "Create tenant", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("PENDING_PROVISIONING");
  await row.getByRole("link", { name, exact: true }).click();
  await page
    .getByRole("button", { name: "Start provisioning", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(
    page.getByText(
      "Request accepted. Provisioning is complete only after the tenant becomes ACTIVE.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.locator(".access-section-heading .access-status"),
  ).not.toHaveText("ACTIVE");
  await expect(
    page.locator(".access-section-heading .access-status"),
  ).toHaveText("ACTIVE", { timeout: 60000 });
});
test("read-only platform UI hides mutations and renders matrix without edit controls", async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: base });
  const p = await c.newPage();
  try {
    await platformLogin(
      p,
      process.env.AUTHZ_E2E_READER_EMAIL!,
      process.env.AUTHZ_E2E_READER_PASSWORD!,
    );
    await p.goto("/settings/tenants");
    await expect(p.getByRole("table")).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Create tenant", exact: true }),
    ).toHaveCount(0);
    await p.goto("/settings/roles");
    await expect(
      p.getByRole("button", { name: "Create role", exact: true }),
    ).toHaveCount(0);
    await p
      .getByRole("row")
      .filter({ hasText: "UI role " + tag })
      .getByRole("button", { name: "Permissions", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: "Save permissions", exact: true }),
    ).toHaveCount(0);
    await expect(
      p.getByRole("checkbox", { name: "platform.tenants:read", exact: true }),
    ).toBeDisabled();
  } finally {
    await c.close();
  }
});
test("unassigned user sees no privileged Settings navigation and direct route is denied without content flash", async ({
  browser,
}) => {
  const c = await browser.newContext({ baseURL: base }),
    p = await c.newPage();
  try {
    await platformLogin(
      p,
      process.env.AUTHZ_E2E_EMPTY_EMAIL!,
      process.env.AUTHZ_E2E_READER_PASSWORD!,
    );
    await expect(
      p
        .getByRole("navigation", { name: "Settings navigation" })
        .getByRole("link"),
    ).toHaveCount(0);
    await p.goto("/settings/tenants");
    await expect(
      p.getByRole("heading", { name: "Access restricted" }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Create tenant", exact: true }),
    ).toHaveCount(0);
    await expect(p.getByRole("table")).toHaveCount(0);
  } finally {
    await c.close();
  }
});
test("permission revocation refreshes visible actions and direct API calls are rejected", async ({
  browser,
}) => {
  const role = await api("/platform/roles", "POST", {
    code: "REVOKE_UI_" + tag.toUpperCase(),
    name: "Revocable UI",
  });
  expect(role.status).toBe(201);
  const permissions = [
    "platform.settings:read",
    "platform.tenants:read",
    "platform.tenants:create",
  ];
  expect(
    (
      await api(`/platform/roles/${role.body.id}/permissions`, "PUT", {
        permissions,
      })
    ).status,
  ).toBe(200);
  const mail = "revoke-ui-" + tag + "@test.invalid",
    pw = process.env.AUTHZ_E2E_READER_PASSWORD!,
    user = await api("/platform/users", "POST", { email: mail, password: pw });
  expect(user.status).toBe(201);
  expect(
    (
      await api(`/platform/users/${user.body.id}/roles`, "PUT", {
        roleIds: [role.body.id],
      })
    ).status,
  ).toBe(200);
  const c = await browser.newContext({ baseURL: base }),
    p = await c.newPage();
  try {
    await platformLogin(p, mail, pw);
    await p.goto("/settings/tenants");
    await expect(
      p.getByRole("button", { name: "Create tenant", exact: true }),
    ).toBeVisible();
    expect(
      (
        await api(`/platform/roles/${role.body.id}/permissions`, "PUT", {
          permissions: permissions.filter(
            (x) => x !== "platform.tenants:create",
          ),
        })
      ).status,
    ).toBe(200);
    await expect(
      p.getByRole("button", { name: "Create tenant", exact: true }),
    ).toHaveCount(0, { timeout: 10000 });
    const pair = await api(
      "/platform/auth/login",
      "POST",
      { email: mail, password: pw },
      "",
    );
    expect(
      (
        await api(
          "/admin/tenants",
          "POST",
          { name: "Denied", code: "DENIED_UI", slug: "denied-ui" },
          pair.body.accessToken,
        )
      ).status,
    ).toBe(403);
  } finally {
    await c.close();
  }
});
test("desktop and mobile Settings remain usable with no page overflow", async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/settings/roles");
  await expect(page.getByRole("table")).toBeVisible();
  await page.screenshot({
    path: "test-results/authorization-settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("table")).toBeVisible();
  await expect
    .poll(async () => {
      const box = await page.locator(".access-settings").boundingBox();
      return !!box && box.x <= 32 && box.width >= 330;
    })
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/authorization-settings-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});
test("identity switch clears platform permissions and logout removes privileged navigation", async () => {
  await page.goto("/auth/sign-in");
  await page
    .getByLabel("Company code", { exact: true })
    .fill(process.env.AUTHZ_E2E_TENANT_CODE!);
  await page.locator("#email").fill(process.env.AUTHZ_E2E_TENANT_EMAIL!);
  await page.locator("#password").fill(process.env.AUTHZ_E2E_TENANT_PASSWORD!);
  await page
    .getByRole("button", { name: /Sign in/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/settings$/, { timeout: 30000 });
  const nav = page.getByRole("navigation", { name: "Settings navigation" });
  await expect(
    nav.getByRole("link", { name: "Tenant Management", exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Roles & Permissions", exact: true }),
  ).toBeVisible();
  await page.goto("/settings/tenants");
  await expect(
    page.getByRole("heading", { name: "Access restricted" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /same-admin@test.invalid/ }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.goto("/settings/roles");
  await expect(page).toHaveURL(/\/auth\/sign-in$/, { timeout: 20000 });
  await expect(
    page.getByRole("navigation", { name: "Settings navigation" }),
  ).toHaveCount(0);
});
