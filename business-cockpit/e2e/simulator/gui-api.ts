import type { IncomingMessage, ServerResponse } from 'node:http';
import { cookiesOf, readBody, sendJson, sendNothing } from './http.ts';
import { SESSION_COOKIE } from './login.ts';
import type { Simulator } from './state.ts';
import { handleTaskLists, isTaskListPath } from './tasks.ts';
import { handleUserTask, isUserTaskPath } from './user-task-page.ts';
import { handleWorkflowModules, isWorkflowModulePath } from './workflow-modules.ts';

export const GUI_API_BASE_PATH = '/gui/api/v1';

const SETTINGS_PATH = /^\/app\/current-user\/settings\/([^/]+)$/;

/** Answers the part of the GUI API below the base path. Returns false for a path it does not know. */
export async function handleGuiApi(
  simulator: Simulator,
  request: IncomingMessage,
  response: ServerResponse,
  pathBelowBase: string,
): Promise<boolean> {
  const loggedIn = simulator.userOfSession(cookiesOf(request)[SESSION_COOKIE]);

  // These two are open to everybody, so the frame can stand before anybody is logged in.
  if (pathBelowBase === '/app/info') {
    sendJson(response, simulator.state.appInformation);
    return true;
  }
  if (pathBelowBase === '/app/current-user') {
    if (loggedIn) sendJson(response, loggedIn.user);
    else sendNothing(response);
    return true;
  }

  const isKnown =
    pathBelowBase === '/app/current-user/group-hierarchy' ||
    SETTINGS_PATH.test(pathBelowBase) ||
    isTaskListPath(pathBelowBase) ||
    isUserTaskPath(pathBelowBase) ||
    isWorkflowModulePath(pathBelowBase);
  if (!isKnown) return false;
  if (!loggedIn) {
    sendNothing(response, 401);
    return true;
  }

  if (isTaskListPath(pathBelowBase)) return handleTaskLists(simulator, request, response, pathBelowBase, loggedIn.user.id);
  if (isUserTaskPath(pathBelowBase)) {
    await handleUserTask(simulator, request, response, pathBelowBase);
    return true;
  }
  if (isWorkflowModulePath(pathBelowBase)) {
    handleWorkflowModules(simulator, request, response, pathBelowBase);
    return true;
  }

  if (pathBelowBase === '/app/current-user/group-hierarchy') {
    sendJson(response, loggedIn.groupHierarchy);
    return true;
  }

  const key = decodeURIComponent(SETTINGS_PATH.exec(pathBelowBase)![1]);
  const settingsOfUser = (simulator.state.settings[loggedIn.user.id] ??= {});
  if (request.method === 'GET') {
    if (key in settingsOfUser) sendJson(response, settingsOfUser[key]);
    else sendNothing(response, 404);
  } else if (request.method === 'PUT') {
    settingsOfUser[key] = JSON.parse(await readBody(request));
    sendNothing(response, 204);
  } else if (request.method === 'DELETE') {
    delete settingsOfUser[key];
    sendNothing(response, 204);
  } else {
    sendNothing(response, 405);
  }
  return true;
}
