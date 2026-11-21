import type { BcPageParts, UserTask } from '@example/bc-module-kit';
import { names } from '../element-names';

const PROCESS = 'angular-claim';

// It names the web components as strings and imports no form, so no Angular code comes along.
export const userTaskForm = (userTask: UserTask): BcPageParts | undefined => {
  if (userTask.bpmnProcessId !== PROCESS) return undefined;
  if (userTask.taskDefinition !== 'check') return undefined;
  return {
    entry: 'ClaimForms',
    element: {
      all: names.userTask(PROCESS, 'check', 'all'),
      body: names.userTask(PROCESS, 'check', 'body'),
      information: names.userTask(PROCESS, 'check', 'information'),
      actions: names.userTask(PROCESS, 'check', 'actions'),
    },
  };
};
