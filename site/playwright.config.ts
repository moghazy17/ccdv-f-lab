import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4321/ccdv-f-lab/",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock",
    url: "http://127.0.0.1:4321/ccdv-f-lab/",
    reuseExistingServer: !process.env.CI
  }
});
