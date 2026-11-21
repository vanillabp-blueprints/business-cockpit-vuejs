import { names } from '../element-names.js';

const PROCESS = 'vue-loan';

// Plain JavaScript: it names the web components as strings and imports no form.
export const userTaskForm = (userTask) => {
  if (userTask.bpmnProcessId !== PROCESS) return undefined;
  switch (userTask.taskDefinition) {
    case 'review':
      return {
        entry: 'LoanForms',
        element: {
          all: names.userTask(PROCESS, 'review', 'all'),
          body: names.userTask(PROCESS, 'review', 'body'),
          information: names.userTask(PROCESS, 'review', 'information'),
          actions: names.userTask(PROCESS, 'review', 'actions'),
        },
      };
    case 'approve':
      // Areas this cockpit does not know, and the area all: the cockpit draws all.
      return {
        entry: 'LoanForms',
        element: { all: names.userTask(PROCESS, 'approve', 'all'), sidebar: names.userTask(PROCESS, 'approve', 'sidebar') },
      };
    case 'only-body':
      return { entry: 'LoanForms', element: { body: names.userTask(PROCESS, 'only-body', 'body') } };
    default:
      return undefined;
  }
};
