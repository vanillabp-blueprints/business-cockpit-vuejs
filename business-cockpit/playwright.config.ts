import { defineConfig } from '@playwright/test';

const simulatorPort = 8090;
const chromiumOfThisMachine = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// The tests start no cockpit backend and need no Java. The simulator serves the built user
// interface and answers the GUI API, so the interface is built first.
export default defineConfig({
  testDir: 'e2e/tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${simulatorPort}`,
    launchOptions: chromiumOfThisMachine ? { executablePath: chromiumOfThisMachine } : {},
  },
  webServer: {
    command: 'npm run build --workspace packages/ui && node e2e/simulator/main.ts',
    url: `http://localhost:${simulatorPort}/simulator/initial-state`,
    env: { SIMULATOR_PORT: String(simulatorPort) },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
