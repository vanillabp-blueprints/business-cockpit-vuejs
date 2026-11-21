import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as types from '../dist/index.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const uiUriTypes = JSON.parse(readFileSync(new URL('../ui-uri-types.json', import.meta.url), 'utf8'));

test('PKG-006 the types library has no dependencies and no peer dependencies', () => {
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.peerDependencies, undefined);
});

test('PKG-017 ui-uri-types.json has one TypeScript constant for each of its values', () => {
  assert.ok(uiUriTypes.length > 0);
  for (const { name, description } of uiUriTypes) {
    assert.ok(description.length > 0, `${name} has a description`);
    assert.equal(types[`UI_URI_TYPE_${name}`], name, `constant UI_URI_TYPE_${name}`);
  }
  const constants = Object.keys(types).filter((key) => key.startsWith('UI_URI_TYPE_'));
  assert.equal(constants.length, uiUriTypes.length, 'no constant without an entry in the file');
});

test('PKG-017 ui-uri-types.json is part of the published package', () => {
  assert.ok(packageJson.files.includes('ui-uri-types.json'));
});

test('PKG-002 the types are generated from the OpenAPI file, not written by hand', () => {
  assert.ok(existsSync(new URL('../src/generated/official-gui-api/types.gen.ts', import.meta.url)));
});

test('PKG-033 the theme token names are CSS custom properties with a common prefix', () => {
  for (const name of Object.values(types.THEME_TOKENS)) {
    assert.match(name, /^--bc-[a-z-]+$/);
  }
});
