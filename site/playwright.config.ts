import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Two workers, not the default half-of-cores. Several specs build the whole site in a temporary
  // directory behind a shared lock, and the lab specs run a real CPython in WebAssembly, so extra
  // workers do not finish the suite sooner - they starve those builds of CPU until the spec waiting
  // on the lock exceeds its timeout. Fewer workers makes each heavy test finish faster and the
  // build queue drain sooner.
  workers: 2,
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
