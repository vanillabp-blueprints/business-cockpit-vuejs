import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson, sendNothing } from './http.ts';
import type { Simulator } from './state.ts';

const MODULE_PATH = /^\/workflow-module(?:\/([^/]+))?$/;

export function isWorkflowModulePath(pathBelowBase: string): boolean {
  return MODULE_PATH.test(pathBelowBase);
}

/** The registry of the modules the user may see, and one module of it. */
export function handleWorkflowModules(simulator: Simulator, request: IncomingMessage, response: ServerResponse, pathBelowBase: string): void {
  if (request.method !== 'GET') return sendNothing(response, 405);
  const moduleId = MODULE_PATH.exec(pathBelowBase)![1];
  if (moduleId === undefined) return sendJson(response, { modules: simulator.state.workflowModules });
  const module = simulator.state.workflowModules.find((candidate) => candidate.id === decodeURIComponent(moduleId));
  if (module) sendJson(response, module);
  else sendNothing(response, 404);
}
