import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/auth/sign-in");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("protected routes, validation, login and logout", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Welcome, Alex" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});
test("users create, edit, search, delete and empty state", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await expect(page.getByText("Olivia Rhye")).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/users-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add user", exact: true }).click();
  await page.getByLabel("Full name").fill("Test Member");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Save user", exact: true }).click();
  await expect(page.getByText("User saved.", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("test@example.com");
  await expect(
    page.getByRole("cell").filter({ hasText: "Test Member" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Test Member", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Updated Member");
  await page.getByRole("button", { name: "Save user", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete Updated Member", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Updated Member", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No members found" }),
  ).toBeVisible();
});
test("language, theme, settings and session reset", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Workspace name").fill("New workspace");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Settings saved.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Language", { exact: true }).click();
  await page.getByRole("option", { name: "Tiếng Việt" }).click();
  await expect(
    page.getByRole("heading", { name: "Cài đặt", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Giao diện", { exact: true }).click();
  await page.getByRole("option", { name: "Tối", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại" }),
  ).toBeVisible();
});
test("mobile navigation is usable without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Users", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Users", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Olivia Rhye")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../docs/screenshots/users-mobile.png",
    fullPage: true,
  });
});
test("account recovery and registration clearly identify demo behavior", async ({
  page,
}) => {
  await page.goto("/auth/forgot-password");
  await page.getByLabel("Email address").fill("demo@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Demo request completed. No account or email was created.",
  );
  await page.goto("/auth/sign-up");
  await page.getByLabel("Full name").fill("New Member");
  await page.getByLabel("Email address").fill("new@example.com");
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page
    .getByRole("button", { name: "Create your account", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Demo request completed. No account or email was created.",
  );
});
