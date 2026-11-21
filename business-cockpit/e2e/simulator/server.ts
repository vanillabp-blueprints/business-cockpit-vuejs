import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { CONTROL_PATH_PREFIX, handleControl } from './control.ts';
import { GUI_API_BASE_PATH, handleGuiApi } from './gui-api.ts';
import { cookiesOf, sendNothing } from './http.ts';
import { handleLoginPath, isLoginPath, SESSION_COOKIE, sendToLogin } from './login.ts';
import { Simulator } from './state.ts';
import { isBundleFile, sendBundleFile, sendShell } from './static-files.ts';

/**
 * The simulator of the UI repository. It stands in for the cockpit backend: it serves the built
 * user interface, answers the GUI API and the login, and keeps everything in memory.
 */
export function createSimulatorServer() {
  const simulator = new Simulator();
  const server = createServer((request, response) => {
    answer(simulator, request, response).catch((error: unknown) => {
      console.error(error);
      if (!response.headersSent) sendNothing(response, 500);
    });
  });
  return { server, simulator };
}

async function answer(simulator: Simulator, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://simulator').pathname;
  if (!path.startsWith(CONTROL_PATH_PREFIX) || path.startsWith('/simulator/keycloak/')) {
    simulator.requests.push({ method: request.method ?? 'GET', path });
  }

  if (path.startsWith(CONTROL_PATH_PREFIX) && (await handleControl(simulator, request, response, path))) return;
  if (isLoginPath(path)) return handleLoginPath(simulator, request, response, path);

  if (path.startsWith(`${GUI_API_BASE_PATH}/`)) {
    const isKnown = await handleGuiApi(simulator, request, response, path.slice(GUI_API_BASE_PATH.length));
    if (!isKnown) sendNothing(response, 404);
    return;
  }

  if (isBundleFile(path)) return sendBundleFile(response, path);
  // Like the backend, the simulator does not take a request for an icon as the page the user wanted.
  if (path === '/favicon.ico') return sendNothing(response, 404);

  // index.html and every deep link ask for a login first, as in the backend.
  const isLoggedIn = simulator.userOfSession(cookiesOf(request)[SESSION_COOKIE]) !== undefined;
  if (isLoggedIn || simulator.state.shellIsOpen) return sendShell(response);
  sendToLogin(response, request.url ?? '/');
}
