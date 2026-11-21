import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as types from '@example/bc-types';
import * as kit from '../dist/index.js';
import { checkEntries, DEFAULT_LIMIT_BYTES } from '../dist/check.js';

const kitFolder = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(kitFolder, 'package.json'), 'utf8'));

/** A module folder with a manifest and files, as a build writes it. */
function moduleWith(files, entries = {}, manifestExtras = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'module-'));
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(join(folder, name, '..'), { recursive: true });
    writeFileSync(join(folder, name), source);
  }
  writeFileSync(join(folder, 'bc-manifest.json'), JSON.stringify({ manifestVersion: 1, entries, ...manifestExtras }));
  return join(folder, 'bc-manifest.json');
}

const problemsOf = (manifest, options) => checkEntries(manifest, options).problems.join('\n');

// What @vanillabp/bc-module-kit 0.1.0-snapshot.6 exports, copied from its index.d.ts to compare names and values.
const NAMES_OF_THE_VANILLABP_KIT = [
  'USER_TASK_LIST', 'WORKFLOW_LIST', 'USER_TASK_FORM', 'WORKFLOW_PAGE', 'EXPORT_NAMES', 'DATA_ENTRIES', 'AREA_ALL',
  'MANIFEST_FILE_NAME', 'MANIFEST_VERSION', 'BcManifestError', 'checkManifest', 'readManifest', 'createManifest', 'entryUrl',
  'REQUEST_EVENT', 'RESPONSE_EVENT', 'MESSAGE_EVENT', 'ACTIONS', 'ERROR_CODES', 'DEFAULT_TIMEOUT_MS', 'ACTIONS_WITHOUT_TIMEOUT',
  'BcRequestError', 'requestFromCockpit', 'rejectOpenRequests', 'sendTo', 'receiveMessage', 'showNotification', 'openDialog',
  'closeDialog', 'toBcUserTask', 'toBcWorkflow', 'HOST_PROPERTIES', 'defineBcElement', 'elementPrefix', 'createElementNames',
];

test('PKG-043 the module kit exports everything the VanillaBP kit exports, with the same values', () => {
  for (const name of NAMES_OF_THE_VANILLABP_KIT) assert.ok(name in kit, `${name} is exported`);
  assert.equal(kit.USER_TASK_LIST, 'UserTaskList');
  assert.equal(kit.WORKFLOW_LIST, 'WorkflowList');
  assert.equal(kit.USER_TASK_FORM, 'UserTaskForm');
  assert.equal(kit.WORKFLOW_PAGE, 'WorkflowPage');
  assert.equal(kit.AREA_ALL, 'all');
  assert.equal(kit.MANIFEST_FILE_NAME, 'bc-manifest.json');
  assert.equal(kit.MANIFEST_VERSION, 1);
  assert.deepEqual([kit.REQUEST_EVENT, kit.RESPONSE_EVENT, kit.MESSAGE_EVENT], ['bc-request', 'bc-response', 'bc-message']);
  assert.equal(kit.DEFAULT_TIMEOUT_MS, 30000);
  assert.deepEqual([...kit.ACTIONS_WITHOUT_TIMEOUT], ['cockpit.openDialog']);
  assert.deepEqual(Object.values(kit.ERROR_CODES), ['UNKNOWN_ACTION', 'REFUSED', 'FAILED', 'NO_TARGET', 'TIMEOUT', 'DISCONNECTED']);
  assert.deepEqual(Object.values(kit.ACTIONS), [
    'userTask.open', 'userTask.navigateToWorkflow', 'userTask.claim', 'userTask.unclaim', 'userTask.assign', 'userTask.unassign',
    'workflow.navigateToWorkflow', 'workflow.getUserTasks', 'page.sendTo', 'page.subscribe', 'page.unsubscribe',
    'cockpit.showNotification', 'cockpit.openDialog', 'cockpit.closeDialog',
  ]);
  assert.deepEqual(kit.HOST_PROPERTIES, ['userTask', 'workflow', 'area', 'language', 'currentUser', 'workflowModule', 'data']);
});

test('PKG-043 the four minimum entries of EXPORT_NAMES have the function names of the VanillaBP kit', () => {
  const { Header, ...minimum } = kit.EXPORT_NAMES;
  assert.deepEqual(minimum, { UserTaskList: 'userTaskListColumns', WorkflowList: 'workflowListColumns', UserTaskForm: 'userTaskForm', WorkflowPage: 'workflowPage' });
  assert.equal(Header, 'header');
});

test('PKG-043 the module kit does not depend on the VanillaBP kit, does not bundle it and ships no host', () => {
  assert.equal(JSON.stringify(packageJson).includes('@vanillabp'), false);
  for (const file of readdirSync(join(kitFolder, 'dist')).filter((name) => name.endsWith('.js'))) {
    assert.equal(readFileSync(join(kitFolder, 'dist', file), 'utf8').includes('@vanillabp'), false, `${file} names no VanillaBP package`);
  }
  assert.equal('createModuleHost' in kit, false);
});

test('PKG-043 requestFromCockpit waits for the answer with its own request id, and rejects with the error code the cockpit gave', async () => {
  const element = new EventTarget();
  globalThis.CustomEvent ??= class extends Event {
    constructor(type, init) {
      super(type, init);
      this.detail = init?.detail;
    }
  };
  element.addEventListener('bc-request', (event) => {
    const { requestId, action, args } = event.detail;
    const body = action === 'userTask.claim' ? { ok: false, error: { code: 'REFUSED', status: 409, message: 'ended' } } : { ok: true, result: args };
    // An answer to another request is ignored.
    element.dispatchEvent(new CustomEvent('bc-response', { detail: { requestId: 'someone-else', ok: true, result: 'wrong' } }));
    element.dispatchEvent(new CustomEvent('bc-response', { detail: { requestId, ...body } }));
  });
  assert.deepEqual(await kit.requestFromCockpit(element, 'x.y', { a: 1 }), { a: 1 });
  await assert.rejects(kit.requestFromCockpit(element, 'userTask.claim', {}), (error) => error.code === 'REFUSED' && error.status === 409 && error instanceof kit.BcRequestError);
});

test('PKG-048 the module kit depends on the types library only, has no peer dependencies and exports every constant of the types library again', () => {
  assert.deepEqual(Object.keys(packageJson.dependencies), ['@example/bc-types']);
  assert.equal(packageJson.peerDependencies, undefined);
  for (const name of Object.keys(types)) assert.ok(name in kit, `${name} of the types library is exported by the kit`);
});

test('PKG-041 EXPORT_NAMES names the four minimum entries and the entries of the interview, and DATA_ENTRIES is its keys', () => {
  assert.deepEqual(Object.keys(types.EXPORT_NAMES), ['UserTaskList', 'WorkflowList', 'UserTaskForm', 'WorkflowPage', 'Header']);
  assert.deepEqual([...types.DATA_ENTRIES], Object.keys(types.EXPORT_NAMES));
  assert.equal(kit.EXPORT_NAMES, types.EXPORT_NAMES);
  assert.equal(kit.DATA_ENTRIES, types.DATA_ENTRIES);
  const source = readFileSync(join(kitFolder, '..', 'bc-types', 'src', 'extension-points.ts'), 'utf8');
  assert.match(source, /DATA_ENTRIES = Object\.freeze\(Object\.keys\(EXPORT_NAMES\)\)/, 'DATA_ENTRIES is derived, not listed');
});

test('PKG-041 bc-check-entries takes a data entry from EXPORT_NAMES, checks every entry named with --data-entry, and the default limit is 32 KB of 1024 bytes', () => {
  assert.equal(DEFAULT_LIMIT_BYTES, 32 * 1024);
  const large = 'export const header = () => "' + 'x'.repeat(33 * 1024) + '";';
  assert.match(problemsOf(moduleWith({ 'header.js': large }, { Header: 'header.js' })), /Header: .* more than the limit of 32768 bytes/);
  const justUnder = 'export const header = () => "' + 'x'.repeat(32 * 1024 - 100) + '";';
  assert.equal(problemsOf(moduleWith({ 'header.js': justUnder }, { Header: 'header.js' })), '');
  // An entry of the module's own is checked only when it is named.
  const own = moduleWith({ 'extra.js': large }, { Extra: 'extra.js' });
  assert.equal(problemsOf(own), '');
  assert.match(problemsOf(own, { dataEntries: ['Extra'] }), /Extra: .* more than the limit/);
  assert.equal(problemsOf(own, { dataEntries: ['Extra'], limit: '64kb' }), '');
  // A visual entry may be as large as its framework makes it.
  assert.equal(problemsOf(moduleWith({ 'form.js': large }, { SomeForm: 'form.js' })), '');
});

test('PKG-039 bc-check-entries fails for an entry without a file, for a data entry that is too large and for one that holds framework code', () => {
  assert.match(problemsOf(moduleWith({}, { UserTaskForm: 'missing.js' })), /UserTaskForm: the file missing.js does not exist/);
  assert.match(problemsOf(moduleWith({ 'a.js': 'export const userTaskForm = () => 1;'.padEnd(2000, ' ') }, { UserTaskForm: 'a.js' }), { limit: 1000 }), /more than the limit of 1000 bytes/);
  for (const marker of ['@license React', '__vue_app__', 'ɵɵdefineComponent', '__zone_symbol__', 'litHtmlVersions']) {
    assert.match(problemsOf(moduleWith({ 'a.js': `/* ${marker} */ export const userTaskForm = () => 1;` }, { UserTaskForm: 'a.js' })), /carries no framework/, marker);
  }
  const fine = moduleWith({ 'a.js': 'export const userTaskForm = () => undefined;' }, { UserTaskForm: 'a.js' });
  assert.equal(problemsOf(fine), '');
  const script = join(kitFolder, 'bin', 'bc-check-entries.js');
  assert.match(execFileSync('node', [script, fine]).toString(), /every entry is fine/);
  const failing = spawnSync('node', [script, moduleWith({}, { UserTaskForm: 'missing.js' })]);
  assert.equal(failing.status, 1);
  assert.match(failing.stderr.toString(), /does not exist/);
});

test('PKG-039 bc-check-entries follows the files a data entry imports, so a shared chunk with a framework fails the build', () => {
  const manifest = moduleWith(
    { 'entry.js': 'import { x } from "./chunk.js"; export const userTaskForm = () => x;', 'chunk.js': 'export const x = "__v_isRef";' },
    { UserTaskForm: 'entry.js' },
  );
  assert.match(problemsOf(manifest), /chunk.js contains code of vue/);
});

test('PKG-042 bc-check-entries fails for a bare name, a file outside the folder and a file that does not exist', () => {
  assert.match(problemsOf(moduleWith({ 'a.js': 'import "react"; export const userTaskForm = () => 1;' }, { UserTaskForm: 'a.js' })), /imports "react"/);
  assert.match(problemsOf(moduleWith({ 'a.js': 'import { b } from "./nothing.js"; export const userTaskForm = () => b;' }, { UserTaskForm: 'a.js' })), /\.\/nothing\.js, which does not exist/);
  const outside = moduleWith({ 'sub/a.js': 'import { b } from "../../other.js"; export const userTaskForm = () => b;' }, { UserTaskForm: 'sub/a.js' });
  assert.match(problemsOf(outside), /which lies outside the folder of the manifest/);
  assert.match(problemsOf(moduleWith({ 'a.js': 'const later = () => import("react");\nexport const userTaskForm = later;' }, { UserTaskForm: 'a.js' })), /imports "react"/);
});

test('PKG-042 bc-check-entries fails when a file of the manifest is a whole address, starts with a slash or contains two dots', () => {
  for (const file of ['https://elsewhere.example/a.js', '//elsewhere.example/a.js', '/a.js', '../a.js', 'sub/../../a.js']) {
    assert.match(problemsOf(moduleWith({ 'a.js': 'export const userTaskForm = () => 1;' }, { UserTaskForm: file })), /a.js|file of the entry/, file);
    assert.notEqual(problemsOf(moduleWith({ 'a.js': 'export const userTaskForm = () => 1;' }, { UserTaskForm: file })), '', file);
  }
  assert.equal(problemsOf(moduleWith({ 'a.js': 'export const userTaskForm = () => 1;' }, { UserTaskForm: 'a.js?v=3#top' })), '');
  assert.match(problemsOf(moduleWith({}, { './UserTaskForm': 'a.js' })), /starts with "\.\/"/);
});

test('PKG-051 elementPrefix turns a module id into the prefix of its web components', () => {
  assert.equal(kit.elementPrefix('TaxiRide'), 'taxi-ride');
  assert.equal(kit.elementPrefix('taxi-ride'), 'taxi-ride');
  assert.equal(kit.elementPrefix('loan_approval.2'), 'loan-approval-2');
  assert.equal(kit.elementPrefix('4711'), 'wm-4711');
  assert.equal(kit.elementPrefix(''), 'wm-');
});

test('PKG-051 the module host checks names with the same elementPrefix function', () => {
  const hostSources = ['element-names.ts', 'module-host.ts'].map((file) => readFileSync(join(kitFolder, '..', 'bc-module-host', 'src', file), 'utf8')).join('\n');
  assert.match(hostSources, /import \{[^}]*elementPrefix[^}]*\} from '@example\/bc-module-kit'/);
  assert.doesNotMatch(hostSources, /function elementPrefix|const elementPrefix/);
});

test('PKG-053 createElementNames builds the names of a workflow, a user task and anything else, with -- between two segments', () => {
  const names = kit.createElementNames('TaxiRide', 'mvaro4w0');
  assert.equal(names.userTask('TaxiRide', 'assessRisk', 'form'), 'taxi-ride-mvaro4w0-taxi-ride--assess-risk--form');
  assert.equal(names.workflow('TaxiRide', 'page'), 'taxi-ride-mvaro4w0-taxi-ride--page');
  assert.equal(names.custom('price-chart'), 'taxi-ride-mvaro4w0-price-chart');
  assert.deepEqual(Object.keys(names).sort(), ['custom', 'userTask', 'workflow']);
});

test('PKG-053 createElementNames refuses a part or a custom short name with two hyphens, and a BPMN id with no letter and no digit', () => {
  const names = kit.createElementNames('TaxiRide', 'b1');
  assert.throws(() => names.userTask('TaxiRide', 'assessRisk', 'in--formation'), TypeError);
  assert.throws(() => names.workflow('TaxiRide', '-page'), TypeError);
  assert.throws(() => names.workflow('TaxiRide', 'Page'), TypeError);
  assert.throws(() => names.custom('price--chart'), TypeError);
  assert.throws(() => names.userTask('___', 'assessRisk', 'form'), TypeError);
  assert.throws(() => names.userTask('TaxiRide', '...', 'form'), TypeError);
  assert.throws(() => kit.createElementNames('TaxiRide', 'Not-A-Build'), TypeError);
  assert.equal(names.userTask('assess_risk', 'x', 'form'), names.userTask('assessRisk', 'x', 'form'));
});
