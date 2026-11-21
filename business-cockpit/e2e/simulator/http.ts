import type { IncomingMessage, ServerResponse } from 'node:http';

export function cookiesOf(request: IncomingMessage): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of (request.headers.cookie ?? '').split(';')) {
    const [name, ...value] = pair.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(value.join('='));
  }
  return cookies;
}

export async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

export function sendJson(response: ServerResponse, body: unknown, status = 200): void {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

/** The cockpit answers 200 without a body when nobody is logged in; the user interface relies on that. */
export function sendNothing(response: ServerResponse, status = 200): void {
  response.writeHead(status, { 'Content-Length': '0' });
  response.end();
}

export function redirect(response: ServerResponse, location: string, headers: Record<string, string | string[]> = {}): void {
  response.writeHead(302, { Location: location, ...headers });
  response.end();
}

export function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
}
