import { expect, test as base, type APIRequestContext, type Page } from '@playwright/test';
import type { RequestLogEntry, SimulatorState } from '../simulator/state.ts';

export { expect };

export class SimulatorControl {
  readonly #request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.#request = request;
  }

  async reset(): Promise<void> {
    await this.#request.post('/simulator/reset');
  }

  async change(changes: Partial<SimulatorState>): Promise<void> {
    await this.#request.post('/simulator/state', { data: changes });
  }

  /** The server forgets every login, but the browser keeps its cookie. */
  async expireSessions(): Promise<void> {
    await this.#request.post('/simulator/expire-sessions');
  }

  async requests(): Promise<RequestLogEntry[]> {
    return (await this.#request.get('/simulator/requests')).json();
  }

  async guiApiRequests(): Promise<RequestLogEntry[]> {
    return (await this.requests()).filter((entry) => entry.path.startsWith('/gui/api/v1/'));
  }
}

/** Every test starts with a fresh simulator, so no test depends on another. */
export const test = base.extend<{ simulator: SimulatorControl }>({
  simulator: [
    async ({ request }, use) => {
      const simulator = new SimulatorControl(request);
      await simulator.reset();
      await use(simulator);
    },
    // Automatic, so also a test that does not name the simulator starts with a fresh one.
    { auto: true },
  ],
});

export const IDENTITY_PROVIDER_LOGIN = /\/simulator\/keycloak\/login$/;

/** Opens an address of the cockpit and logs in at the simulated identity provider when it asks for it. */
export async function logInAs(page: Page, userId = 'clerk', address = '/'): Promise<void> {
  await page.goto(address);
  await page.getByRole('button', { name: userId, exact: true }).click();
  await expect(page.getByTestId('user-name')).toBeVisible();
}

export async function openMenu(page: Page): Promise<void> {
  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('menu-user')).toBeVisible();
}
