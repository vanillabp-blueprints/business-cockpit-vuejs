import { defineConfig } from '@playwright/test';

const simulatorPort = 8090;
const chromiumOfThisMachine = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// The tests start no cockpit backend and need no Java. The simulator serves the built user
// interface and the built test modules and answers the GUI API, so they are built first. Each build
// leaves out what is up to date.
const buildEverythingTheSimulatorServes = [
  'npm run build',
  '--workspace packages/bc-types --workspace packages/bc-module-kit --workspace packages/bc-module-host',
  '--workspace packages/ui',
  '--workspace e2e/modules/react-module --workspace e2e/modules/vue-module --workspace e2e/modules/angular-module',
].join(' ');
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
    command: `${buildEverythingTheSimulatorServes} && node e2e/simulator/main.ts`,
    url: `http://localhost:${simulatorPort}/simulator/initial-state`,
    env: { SIMULATOR_PORT: String(simulatorPort) },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
