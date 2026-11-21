import type { IncomingMessage, ServerResponse } from 'node:http';
import { readBody, sendJson, sendNothing } from './http.ts';
import { initialState, type Simulator, type SimulatorState } from './state.ts';

export const CONTROL_PATH_PREFIX = '/simulator/';

/**
 * The calls a test uses to set up and inspect the simulated cockpit. The real cockpit has none of
 * them, so the user interface never calls them.
 */
export async function handleControl(
  simulator: Simulator,
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
): Promise<boolean> {
  if (path === '/simulator/reset') {
    simulator.reset();
  } else if (path === '/simulator/state') {
    const changes = JSON.parse(await readBody(request)) as Partial<SimulatorState>;
    simulator.state = { ...simulator.state, ...changes };
  } else if (path === '/simulator/initial-state') {
    sendJson(response, initialState());
    return true;
  } else if (path === '/simulator/expire-sessions') {
    // The browser keeps its cookie but the server no longer knows it, as after seven days of login.
    simulator.sessions.clear();
  } else if (path === '/simulator/requests') {
    sendJson(response, simulator.requests);
    return true;
  } else {
    return false;
  }
  sendNothing(response, 204);
  return true;
}
