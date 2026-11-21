import { expect, logInAs, openMenu, test } from '../support/test.ts';

const manyRoles = Array.from({ length: 40 }, (_, index) => `Orders.Right${String(index).padStart(2, '0')}`);

async function openRightsOverview(page: import('@playwright/test').Page) {
  await openMenu(page);
  await page.getByTestId('user-name').hover();
  await expect(page.getByTestId('rights-overview')).toBeVisible();
}

test.describe('the header', () => {
  test('NAV-013 the header shows the title of the app info and the version on mouse-over', async ({ page }) => {
    await logInAs(page);
    await expect(page.getByTestId('header-title')).toHaveText('Cockpit');
    await expect(page).toHaveTitle('Example Business Cockpit');

    await page.getByTestId('header-title').hover();
    await expect(page.getByTestId('header-version-info')).toContainText('Version 1.2.3, erstellt am');
  });

  test('I18N-005 numbers and dates are formatted for the chosen language', async ({ page }) => {
    await logInAs(page);
    await page.getByTestId('header-title').hover();
    await expect(page.getByTestId('header-version-info')).toContainText(/\d{1,2}\.\d{1,2}\.2026/);

    await openMenu(page);
    await page.getByTestId('language-en').click();
    await page.mouse.move(5, 5);
    await page.getByTestId('header-title').hover();
    await expect(page.getByTestId('header-version-info')).toContainText(/built on Nov \d{1,2}, 2026/);
  });
});

test.describe('the language', () => {
  test('I18N-002 the interface starts in the default language, whatever the browser asks for', async ({ browser }) => {
    const englishBrowser = await browser.newContext({ locale: 'en-US' });
    const page = await englishBrowser.newPage();
    await logInAs(page);
    await openMenu(page);
    await expect(page.getByTestId('logout')).toHaveText('Abmelden');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await englishBrowser.close();
  });

  test('I18N-001 the texts come from the language files, so a switch changes every text at once', async ({ page }) => {
    await logInAs(page);
    await openMenu(page);
    await page.getByTestId('language-fr').click();
    await expect(page.getByTestId('logout')).toHaveText('Se déconnecter');
    await page.getByTestId('language-en').click();
    await expect(page.getByTestId('logout')).toHaveText('Log out');
  });
});

test.describe('the menu', () => {
  test('NAV-011 the top of the menu shows the user with a round badge, and details on mouse-over of the badge', async ({ page }) => {
    await logInAs(page);
    await openMenu(page);
    const badge = page.getByTestId('menu-user').getByTestId('user-badge');
    await expect(badge).toHaveText('CC');
    expect(await badge.evaluate((element) => getComputedStyle(element).borderRadius)).toMatch(/50%|9999px/);
    await expect(page.getByTestId('user-name')).toHaveText('C. Clerk');

    await badge.hover();
    const details = page.getByTestId('user-badge-details');
    await expect(details).toContainText('Clara Clerk');
    await expect(details).toContainText('Benutzerkennung: clerk');
    await expect(details).toContainText('clerk@example.com');
  });

  test('NAV-011 a user without a long form shows the initials of the user id', async ({ page, simulator }) => {
    await simulator.change({
      users: [{ user: { id: 'anna.meier', groups: [] }, groupHierarchy: { givenByOrganisation: [], modules: [] } }],
    });
    await logInAs(page, 'anna.meier');
    await openMenu(page);
    await expect(page.getByTestId('menu-user').getByTestId('user-badge')).toHaveText('AM');
    await expect(page.getByTestId('user-name')).toHaveText('anna.meier');
  });

  test('NAV-029 below the user come the entries, then the language switch, and the logout at the end', async ({ page }) => {
    await logInAs(page);
    await openMenu(page);
    const top = async (testId: string) => (await page.getByTestId(testId).boundingBox())!.y;

    expect(await top('menu-user')).toBeLessThan(await top('menu-entries'));
    expect(await top('menu-entries')).toBeLessThan(await top('language-switch'));
    expect(await top('language-switch')).toBeLessThan(await top('logout'));
    const menu = (await page.getByTestId('menu').boundingBox())!;
    const logout = (await page.getByTestId('logout').boundingBox())!;
    expect(menu.y + menu.height - (logout.y + logout.height)).toBeLessThan(20);
  });
});

test.describe('the overview of roles and rights', () => {
  test('NAV-019 opens below the name on mouse-over, aligned to its right edge, and is asked once', async ({ page, simulator }) => {
    await logInAs(page);
    await openMenu(page);
    expect(await simulator.guiApiRequests()).not.toContainEqual({ method: 'GET', path: '/gui/api/v1/app/current-user/group-hierarchy' });

    await page.getByTestId('user-name').hover();
    const overview = page.getByTestId('rights-overview');
    await expect(overview).toBeVisible();
    const name = (await page.getByTestId('user-name').boundingBox())!;
    const box = (await overview.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
    expect(Math.abs(box.x + box.width - (name.x + name.width))).toBeLessThan(2);

    // The mouse can move into the overview, and the overview closes when it leaves both.
    await overview.hover();
    await expect(overview).toBeVisible();
    await page.mouse.move(100, 500);
    await expect(overview).toBeHidden();

    await page.getByTestId('user-name').hover();
    await expect(overview).toBeVisible();
    const askedForHierarchy = (await simulator.guiApiRequests()).filter((entry) => entry.path.endsWith('/group-hierarchy'));
    expect(askedForHierarchy).toHaveLength(1);
  });

  test('NAV-019 says "Loading" while the data loads', async ({ page }) => {
    await logInAs(page);
    await page.route('**/group-hierarchy', async (route) => {
      await new Promise((later) => setTimeout(later, 800));
      await route.continue();
    });
    await openMenu(page);
    await page.getByTestId('user-name').hover();
    await expect(page.getByTestId('rights-loading')).toHaveText('Lädt …');
    await expect(page.getByTestId('rights-table')).toBeVisible();
  });

  test('NAV-019 is at most about two thirds of the window high and scrolls inside', async ({ page, simulator }) => {
    await simulator.change({
      users: [
        {
          user: { id: 'clerk', display: 'Clara Clerk', groups: [] },
          groupHierarchy: {
            givenByOrganisation: ['Staff'],
            modules: [{ workflowModuleId: 'orders', entries: [{ group: 'Staff', givenByOrganisation: true, targets: manyRoles }] }],
          },
        },
      ],
    });
    await page.setViewportSize({ width: 1280, height: 600 });
    await logInAs(page);
    await openRightsOverview(page);

    const overview = page.getByTestId('rights-overview');
    await expect(page.getByTestId('rights-row').first()).toBeVisible();
    const box = (await overview.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(600 * 0.7);
    expect(await overview.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  });

  test('NAV-020 NAV-021 each module has a table with name, kind and who gives it; roles come first', async ({ page }) => {
    await logInAs(page);
    await openRightsOverview(page);

    const tables = page.getByTestId('rights-table');
    await expect(tables).toHaveCount(1);
    await expect(tables.getByRole('heading')).toHaveText('orders');
    await expect(tables.locator('th')).toHaveText(['Name', 'Art', 'Vergeben durch']);
    const rows = await tables.getByTestId('rights-row').allInnerTexts();
    expect(rows.map((row) => row.split('\t'))).toEqual([
      ['AccountManagement', 'Rolle', 'Organisation'],
      ['User', 'Rolle', 'AccountManagement'],
      ['Orders.Cancel', 'Recht', 'AccountManagement'],
      ['Orders.View', 'Recht', 'User'],
    ]);
  });

  test('NAV-030 a target from two groups has two rows, and the texts but not the names are translated', async ({ page, simulator }) => {
    await simulator.change({
      users: [
        {
          user: { id: 'clerk', display: 'Clara Clerk', groups: [] },
          groupHierarchy: {
            givenByOrganisation: ['A', 'B'],
            modules: [
              {
                workflowModuleId: 'orders',
                entries: [
                  { group: 'A', givenByOrganisation: true, targets: ['Orders.View'] },
                  { group: 'B', givenByOrganisation: true, targets: ['Orders.View'] },
                ],
              },
            ],
          },
        },
      ],
    });
    await logInAs(page);
    await openMenu(page);
    await page.getByTestId('language-en').click();
    await page.getByTestId('user-name').hover();

    await expect(page.getByTestId('rights-overview').getByRole('heading', { name: 'Roles and rights' })).toBeVisible();
    await expect(page.getByTestId('rights-overview')).toContainText('The organisation gives you roles.');
    await expect(page.getByTestId('rights-overview').locator('th')).toHaveText(['Name', 'Kind', 'Given by']);
    const rows = (await page.getByTestId('rights-row').allInnerTexts()).map((row) => row.split('\t'));
    expect(rows).toEqual([
      ['A', 'Role', 'Organisation'],
      ['B', 'Role', 'Organisation'],
      ['Orders.View', 'Right', 'A'],
      ['Orders.View', 'Right', 'B'],
    ]);
  });

  test('NAV-022 says that no roles or rights are known when the request fails or no module is left', async ({ page, simulator }) => {
    await logInAs(page);
    await page.route('**/group-hierarchy', (route) => route.fulfill({ status: 500 }));
    await openRightsOverview(page);
    await expect(page.getByTestId('rights-nothing-known')).toHaveText('Es sind keine Rollen oder Rechte bekannt.');
    await page.reload();
    await page.unroute('**/group-hierarchy');

    await simulator.change({
      users: [
        {
          user: { id: 'clerk', display: 'Clara Clerk', groups: [] },
          groupHierarchy: { givenByOrganisation: ['Staff'], modules: [] },
        },
      ],
    });
    await page.reload();
    await openRightsOverview(page);
    await expect(page.getByTestId('rights-nothing-known')).toBeVisible();
    await expect(page.getByTestId('rights-table')).toHaveCount(0);
  });

  test('NAV-027 the head of the overview shows the badge of the user', async ({ page }) => {
    await logInAs(page);
    await openRightsOverview(page);
    await expect(page.getByTestId('rights-overview').getByTestId('user-badge')).toHaveText('CC');
  });
});
