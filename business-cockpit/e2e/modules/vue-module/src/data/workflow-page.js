import { names } from '../element-names.js';

export const workflowPage = (workflow) => {
  if (workflow.bpmnProcessId !== 'vue-loan') return undefined;
  return { entry: 'LoanForms', element: names.workflow('vue-loan', 'page') };
};
