import { defineConfig, devices } from "@playwright/test";
// Reserved local port for the HTTP interceptor fixture, independent of the browser demo.
process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:18881";
const externalUrl = process.env.E2E_BASE_URL;
export default defineConfig({
  tsconfig: "./tsconfig.json",
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  use: { baseURL: externalUrl ?? "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalUrl ? undefined : {
    command: "pnpm start --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000/auth/sign-in",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
