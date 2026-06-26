import { defineConfig, devices } from "@playwright/test";

const useManagedServer = process.env.PLAYWRIGHT_MANAGED_SERVER === "true";

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: ["**/loginTest.ts", "**/userTest.ts", "**/organizationTest.ts", "**/organizationByUserTest.ts"],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useManagedServer
    ? {
        command: "./node_modules/node/bin/node ./node_modules/vite/bin/vite.js --host localhost --port 3000",
        url: "http://localhost:3000",
        reuseExistingServer: true,
      }
    : undefined,
});
