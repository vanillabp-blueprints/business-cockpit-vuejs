import { readFileSync } from 'node:fs';
import { expect, logInAs, test } from '../support/test.ts';

test('PKG-054 the simulator answers the GUI API in memory and the tests need no Java', async ({ page, request, simulator }) => {
  const information = await request.get('/gui/api/v1/app/info', { headers: { Accept: 'application/json' } });
  expect(await information.json()).toMatchObject({ titleShort: 'Cockpit', version: '1.2.3' });

  const nobodyLoggedIn = await request.get('/gui/api/v1/app/current-user');
  expect(nobodyLoggedIn.status()).toBe(200);
  expect(await nobodyLoggedIn.text()).toBe('');

  await logInAs(page);
  const settingsPath = '/gui/api/v1/app/current-user/settings/language';
  expect((await page.request.get(settingsPath)).status()).toBe(404);
  expect((await page.request.put(settingsPath, { data: JSON.stringify('fr'), headers: { 'Content-Type': 'application/json' } })).status()).toBe(204);
  expect(await (await page.request.get(settingsPath)).json()).toBe('fr');

  // Everything lives in memory only, so a reset forgets it.
  await simulator.reset();
  expect((await page.request.get(settingsPath)).status()).toBe(401);

  const configuration = readFileSync(new URL('../../playwright.config.ts', import.meta.url), 'utf8');
  expect(configuration).not.toMatch(/\b(mvn|java|docker)\b/);
});
