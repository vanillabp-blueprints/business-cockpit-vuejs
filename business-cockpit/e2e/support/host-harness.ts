import { buildSync } from 'esbuild';
import type { Page } from '@playwright/test';
import { logInAs } from './test.ts';

/**
 * The module host of the repository, bundled for a page. A test of a workflow module does the same: it
 * loads the built parts of the module with the host, without a running cockpit.
 */
export function bundleOfModuleHost(): string {
  const { outputFiles } = buildSync({
    stdin: { contents: "export * from '@example/bc-module-host'; export * from '@example/bc-module-kit';", resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    format: 'iife',
    globalName: 'harness',
    write: false,
    platform: 'browser',
  });
  return outputFiles[0].text;
}

/** Logs in and opens a page that is no screen of the cockpit, so the host is the only thing that runs in it. */
export async function openHostHarness(page: Page): Promise<void> {
  await logInAs(page);
  await page.goto('/simulator/initial-state');
  await page.addScriptTag({ content: bundleOfModuleHost() });
}

declare global {
  interface Window {
    harness: typeof import('@example/bc-module-host') & typeof import('@example/bc-module-kit');
  }
}
