import type { IncomingMessage, ServerResponse } from 'node:http';
import { cookiesOf, readBody, redirect, sendHtml } from './http.ts';
import type { Simulator } from './state.ts';

export const LOGIN_START_PATH = '/oauth2/authorization/keycloak';
export const IDENTITY_PROVIDER_LOGIN_PATH = '/simulator/keycloak/login';
export const SESSION_COOKIE = 'bc-session';
const SAVED_REQUEST_COOKIE = 'bc-saved-request';

const sessionCookieOf = (sessionId: string) => `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`;
const noCookie = (name: string) => `${name}=; Path=/; Max-Age=0`;

/** A browser without a login is sent to the login. Like the backend, it remembers where the browser wanted to go. */
export function sendToLogin(response: ServerResponse, wantedPath: string): void {
  redirect(response, LOGIN_START_PATH, {
    'Set-Cookie': `${SAVED_REQUEST_COOKIE}=${encodeURIComponent(wantedPath)}; Path=/; HttpOnly`,
  });
}

export function isLoginPath(path: string): boolean {
  return path === LOGIN_START_PATH || path === IDENTITY_PROVIDER_LOGIN_PATH || path === '/logout';
}

export async function handleLoginPath(
  simulator: Simulator,
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
): Promise<void> {
  if (path === LOGIN_START_PATH) {
    redirect(response, IDENTITY_PROVIDER_LOGIN_PATH);
  } else if (path === IDENTITY_PROVIDER_LOGIN_PATH && request.method === 'GET') {
    sendHtml(response, loginPage(simulator));
  } else if (path === IDENTITY_PROVIDER_LOGIN_PATH) {
    const chosenUser = new URLSearchParams(await readBody(request)).get('user') ?? '';
    if (!simulator.findUser(chosenUser)) return sendHtml(response, loginPage(simulator));
    const wantedPath = cookiesOf(request)[SAVED_REQUEST_COOKIE] || '/';
    redirect(response, wantedPath, {
      'Set-Cookie': [sessionCookieOf(simulator.logIn(chosenUser)), noCookie(SAVED_REQUEST_COOKIE)],
    });
  } else {
    // /logout
    const sessionId = cookiesOf(request)[SESSION_COOKIE];
    if (sessionId) simulator.sessions.delete(sessionId);
    redirect(response, '/', { 'Set-Cookie': noCookie(SESSION_COOKIE) });
  }
}

function loginPage(simulator: Simulator): string {
  const buttons = simulator.state.users
    .map((candidate) => `<button name="user" value="${candidate.user.id}">${candidate.user.id}</button>`)
    .join('\n');
  return `<!doctype html><title>Simulated identity provider</title>
<h1>Simulated identity provider</h1>
<form method="post" action="${IDENTITY_PROVIDER_LOGIN_PATH}">${buttons}</form>`;
}
