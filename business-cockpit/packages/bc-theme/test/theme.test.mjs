import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { lightTheme, darkTheme } from '../dist/index.js';
// The test may read the names from the types library; the theme library itself must not depend on it.
import { THEME_TOKENS } from '../../bc-types/dist/index.js';

const css = readFileSync(new URL('../dist/bc-theme.css', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tokenNames = Object.values(THEME_TOKENS);

test('PKG-033 the theme sets every custom property named in the types library, in light and dark', () => {
  assert.deepEqual(Object.keys(lightTheme).sort(), [...tokenNames].sort());
  assert.deepEqual(Object.keys(darkTheme).sort(), [...tokenNames].sort());
  for (const name of tokenNames) {
    assert.ok(css.includes(`${name}: ${lightTheme[name]};`), `${name} in the light block`);
    assert.ok(css.includes(`${name}: ${darkTheme[name]};`), `${name} in the dark block`);
  }
});

test('PKG-033 the theme library has no dependencies', () => {
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.peerDependencies, undefined);
});

test('CUST-002 colours, fonts and logo are those of the design system', () => {
  assert.equal(lightTheme['--bc-color-text'], '#663300', 'brand brown');
  assert.equal(lightTheme['--bc-color-primary'], '#FFC000', 'brand amber');
  assert.equal(darkTheme['--bc-color-background'], '#181106', 'warm near-black');
  assert.match(lightTheme['--bc-font-family'], /^"Carlito"/);
  assert.ok(existsSync(new URL('../dist/fonts/Carlito-Regular.ttf', import.meta.url)));
  assert.ok(existsSync(new URL('../dist/logo/vanillabp-logo-light.svg', import.meta.url)));
});

test('CUST-002 the row-state colours are derived from the palette and differ from each other', () => {
  const states = ['new', 'changed', 'removed', 'ended'].map((state) => lightTheme[`--bc-color-row-${state}`]);
  assert.equal(new Set(states).size, states.length);
  for (const colour of states) {
    assert.notEqual(colour, lightTheme['--bc-color-background'], 'a state must be visible on the background');
  }
  assert.notEqual(lightTheme['--bc-color-text-suspended'], lightTheme['--bc-color-text']);
});

test('PKG-033 the CSS file carries the base styles of the page and a dark variant', () => {
  assert.match(css, /@font-face/);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /html, body \{/);
});
