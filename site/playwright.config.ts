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
    reuseExistingServer: !process.env.CI,
    env: {
      // Astro sends `preview` to the background when it detects it is being run by an AI agent,
      // and refuses --ignore-lock there, because a backgrounded server is found again through the
      // lock file this flag declines to write. Playwright owns this server's lifetime itself, so
      // the detection is wrong here and the run dies before a single test starts. This variable
      // is the switch that turns the detection off: it tells Astro the backgrounding decision is
      // already made, leaving --ignore-lock free to keep the server in the foreground and
      // untracked. It does not put anything in the background.
      ASTRO_PREVIEW_BACKGROUND: "1"
    }
  }
});
