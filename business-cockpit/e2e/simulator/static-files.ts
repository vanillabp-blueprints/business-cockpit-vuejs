import { createReadStream, existsSync, statSync } from 'node:fs';
import type { ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const userInterfaceFolder = fileURLToPath(new URL('../../packages/ui/dist', import.meta.url));

const mediaTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

/** The files the bundle brings lie below /assets/ and are open, like in the backend. */
export function isBundleFile(path: string): boolean {
  return path.startsWith('/assets/');
}

export function sendBundleFile(response: ServerResponse, path: string): void {
  const file = join(userInterfaceFolder, normalize(path));
  const isInsideBundle = file.startsWith(userInterfaceFolder);
  if (!isInsideBundle || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': mediaTypes[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(response);
}

/** Every unknown path is a screen of the single-page application, so it gets index.html. */
export function sendShell(response: ServerResponse): void {
  sendBundleFile(response, '/index.html');
}
