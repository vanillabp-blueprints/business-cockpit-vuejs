import { names } from '../element-names.js';

const PROCESS = 'react-order';

// Plain JavaScript: it names the web components as strings and imports no form.
export const userTaskForm = (userTask) => {
  if (userTask.bpmnProcessId !== PROCESS) return undefined;
  switch (userTask.taskDefinition) {
    case 'assessRisk':
      return {
        entry: 'RiskForms',
        element: {
          all: names.userTask(PROCESS, 'assessRisk', 'all'),
          body: names.userTask(PROCESS, 'assessRisk', 'body'),
          information: names.userTask(PROCESS, 'assessRisk', 'information'),
          actions: names.userTask(PROCESS, 'assessRisk', 'actions'),
        },
      };
    case 'confirm':
      return { entry: 'RiskForms', element: names.userTask(PROCESS, 'confirm', 'page') };
    default:
      return undefined;
  }
};
