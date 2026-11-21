import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, IDENTITY_PROVIDER_LOGIN, logInAs, openMenu, test } from '../support/test.ts';

const userInterfaceSource = fileURLToPath(new URL('../../packages/ui/src', import.meta.url));

function sourceFilesOfTheUserInterface(folder = userInterfaceSource): string[] {
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.name !== 'generated')
    .flatMap((entry) => {
      const path = join(folder, entry.name);
      return entry.isDirectory() ? sourceFilesOfTheUserInterface(path) : [path];
    });
}

test('AUTH-002 an answer of current-user without a body sends the browser to the login', async ({ page, simulator }) => {
  // The shell is open, as when the interface is hosted in front of the backend, so it loads without a login.
  await simulator.change({ shellIsOpen: true });
  await page.goto('/');
  await expect(page).toHaveURL(IDENTITY_PROVIDER_LOGIN);
  expect(await simulator.guiApiRequests()).toContainEqual({ method: 'GET', path: '/gui/api/v1/app/current-user' });
});

test('AUTH-003 after the login the interface shows the user of current-user', async ({ page }) => {
  await logInAs(page);
  await expect(page.getByTestId('open-menu')).toBeVisible();
  await page.getByTestId('open-menu').click();
  await expect(page.getByTestId('user-name')).toHaveText('C. Clerk');
  await expect(page.getByTestId('menu-user').getByTestId('user-badge')).toHaveText('CC');
});

test('AUTH-004 a 401 on a later request sends the browser to the login and shows no error page', async ({ page, simulator }) => {
  await logInAs(page);
  await openMenu(page);

  await simulator.expireSessions();
  await page.getByTestId('user-name').hover();

  await expect(page).toHaveURL(IDENTITY_PROVIDER_LOGIN);
  await expect(page.getByText(/error|fehler|401/i)).toHaveCount(0);
});

test('AUTH-005 the interface has no login form, no user management and no rights check of its own', async ({ page }) => {
  await logInAs(page);
  await page.goto('/login');
  await expect(page.getByTestId('open-menu')).toBeVisible();
  await expect(page.locator('input[type=password], form')).toHaveCount(0);

  const source = sourceFilesOfTheUserInterface().map((file) => readFileSync(file, 'utf8')).join('\n');
  expect(source).not.toMatch(/type="password"|\/api\/login|usermanagement/i);
});

test('AUTH-006 the interface asks nothing in the background to stay logged in', async ({ page, simulator }) => {
  await page.clock.install();
  await logInAs(page);
  // The files of the bundle may still arrive late, for example the icon. They are no sign of a keep-alive.
  const questionsOfThePage = async () => (await simulator.requests()).filter((entry) => !entry.path.startsWith('/assets/'));
  const requestsAfterStart = await questionsOfThePage();

  await page.clock.runFor(13 * 60 * 60 * 1000);

  expect(await questionsOfThePage()).toEqual(requestsAfterStart);
});

test('AUTH-007 /logout ends the session and shows the start page', async ({ page, simulator }) => {
  await logInAs(page);
  await openMenu(page);
  await page.getByTestId('logout').click();

  // The start page is the first stop; without a login the backend sends the browser on to the login.
  await expect(page).toHaveURL(IDENTITY_PROVIDER_LOGIN);
  const requests = await simulator.requests();
  const logoutAt = requests.findIndex((entry) => entry.path === '/logout');
  expect(logoutAt).toBeGreaterThan(-1);
  expect(requests[logoutAt + 1]).toEqual({ method: 'GET', path: '/' });
  const cookieNames = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(cookieNames).not.toContain('bc-session');
});

test('AUTH-008 the groups come from current-user, not from the token', async ({ page }) => {
  await logInAs(page);
  // The cookie of the login cannot be read by the page, and no code of the interface decodes a token.
  const cookiesSeenByThePage = await page.evaluate(() => document.cookie);
  expect(cookiesSeenByThePage).toBe('');
  const source = sourceFilesOfTheUserInterface().map((file) => readFileSync(file, 'utf8')).join('\n');
  expect(source).not.toMatch(/document\.cookie|atob\(|jwt-decode|JSON\.parse\(.*split\('\.'\)/);
});

test('AUTH-009 a browser without a login gets the login before index.html and before any deep link', async ({ page, request }) => {
  for (const address of ['/', '/tasks/open']) {
    const answer = await request.get(address, { maxRedirects: 0 });
    expect(answer.status()).toBe(302);
    expect(answer.headers().location).toContain('/oauth2/authorization/');
  }

  await page.goto('/tasks/open');
  await expect(page).toHaveURL(IDENTITY_PROVIDER_LOGIN);
  expect(await page.content()).not.toContain('id="app"');

  await page.getByRole('button', { name: 'clerk', exact: true }).click();
  await expect(page.getByTestId('user-name')).toBeVisible();
});

test('NAV-004 a deep link opened in a new browser shows its screen after the login', async ({ browser }) => {
  const newBrowser = await browser.newContext();
  const page = await newBrowser.newPage();
  await logInAs(page, 'clerk', '/some/deep/link?filter=open');
  await expect(page).toHaveURL(/\/some\/deep\/link\?filter=open$/);
  await newBrowser.close();
});
