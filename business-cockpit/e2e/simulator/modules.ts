import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendNothing } from './http.ts';
import type { SimulatedFile, Simulator } from './state.ts';

export const MODULE_PATH_PREFIX = '/wm/';

/** The built test modules; the cockpit forwards /wm/<id>/ to a module, and the simulator serves its files. */
const BUILT_MODULE_FOLDERS: Record<string, string> = Object.fromEntries(
  ['react-module', 'vue-module', 'angular-module'].map((id) => [id, fileURLToPath(new URL(`../modules/${id}/dist`, import.meta.url))]),
);

const mediaTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.map': 'application/json' };

const MANIFEST_FILE = 'bc-manifest.json';

function sendFile(request: IncomingMessage, response: ServerResponse, path: string, content: Buffer | string, status = 200): void {
  const entityTag = `"${createHash('sha1').update(content).digest('hex')}"`;
  if (status === 200 && request.headers['if-none-match'] === entityTag) return sendNothing(response, 304);
  // The manifest has a fixed name, so it is never cached without asking. The other files carry a hash in their name.
  const cacheControl = path === MANIFEST_FILE ? 'no-cache' : 'public, max-age=31536000, immutable';
  response.writeHead(status, {
    'Content-Type': mediaTypes[extname(path)] ?? 'text/plain',
    ETag: entityTag,
    'Cache-Control': cacheControl,
  });
  response.end(content);
}

async function sendFakeFile(request: IncomingMessage, response: ServerResponse, path: string, file: SimulatedFile): Promise<void> {
  const { body = '', status = 200, delayMs = 0 } = typeof file === 'string' ? { body: file } : file;
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (status === 200) sendFile(request, response, path, body);
  else {
    response.writeHead(status, { 'Content-Type': 'text/plain' });
    response.end(body);
  }
}

/** Serves one file of a module below /wm/<id>/. Without a login the answer is 401, as the cockpit's proxy gives. */
export async function handleModuleFile(simulator: Simulator, request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  const [, moduleId, ...pathParts] = path.slice(MODULE_PATH_PREFIX.length - 1).split('/');
  const fileInModule = pathParts.join('/');
  const fakeFiles = simulator.state.fakeModules[decodeURIComponent(moduleId)];
  if (fakeFiles) {
    const file = fakeFiles[fileInModule];
    if (file === undefined) return sendNothing(response, 404);
    return sendFakeFile(request, response, fileInModule, file);
  }
  const folder = BUILT_MODULE_FOLDERS[decodeURIComponent(moduleId)];
  const file = folder ? join(folder, normalize(`/${fileInModule}`)) : undefined;
  if (!folder || !file || !file.startsWith(folder) || !existsSync(file) || !statSync(file).isFile()) return sendNothing(response, 404);
  sendFile(request, response, fileInModule, readFileSync(file));
}
