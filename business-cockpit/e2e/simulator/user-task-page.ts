import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, sendNothing } from './http.ts';
import type { Simulator } from './state.ts';

const USER_TASK_PATH = /^\/usertask\/([^/]+?)(\/mark-as-read)?$/;
const NOT_AN_ID = new Set(['count', 'mark-as-read']);

export function isUserTaskPath(pathBelowBase: string): boolean {
  const match = USER_TASK_PATH.exec(pathBelowBase);
  return match !== null && !NOT_AN_ID.has(match[1]);
}

/** Reading one user task for its page, and marking it as read or unread. */
export async function handleUserTask(simulator: Simulator, request: IncomingMessage, response: ServerResponse, pathBelowBase: string): Promise<void> {
  const [, encodedId, isMarkAsRead] = USER_TASK_PATH.exec(pathBelowBase)!;
  const task = simulator.state.tasks.find((candidate) => candidate.id === decodeURIComponent(encodedId));

  if (simulator.state.userTaskDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, simulator.state.userTaskDelayMs));
  if (simulator.state.userTaskFailures > 0) {
    simulator.state.userTaskFailures -= 1;
    return sendNothing(response, 500);
  }
  // The same answer for a task that does not exist and for one the user may not see.
  if (!task) return sendNothing(response, 404);

  if (isMarkAsRead && request.method === 'PATCH') {
    const isUnread = new URL(request.url ?? '/', 'http://simulator').searchParams.get('unread') === 'true';
    if (isUnread) delete task.read;
    else task.read = new Date().toISOString();
    return sendNothing(response, 204);
  }
  if (!isMarkAsRead && request.method === 'GET') return sendJson(response, task);
  sendNothing(response, 405);
}
