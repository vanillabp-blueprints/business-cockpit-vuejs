import type { Column, Workflow } from '@example/bc-module-kit';

export const workflowListColumns = (workflow: Workflow): Column[] | undefined => {
  if (workflow.workflowModuleId !== 'angular-module') return undefined;
  return [
    {
      title: { de: 'Versicherter', en: 'Policy holder' },
      path: 'details.policyHolder',
      type: 'value',
      priority: 10,
      width: '10rem',
      show: true,
      sortable: true,
      filterable: true,
      resizeable: true,
    },
  ];
};
