import type { Column, UserTask } from '@example/bc-module-kit';

export const userTaskListColumns = (userTask: UserTask): Column[] | undefined => {
  if (userTask.workflowModuleId !== 'angular-module') return undefined;
  return [
    {
      title: { de: 'Schadensdatum', en: 'Claim date' },
      path: 'details.claimDate',
      type: 'date',
      priority: 30,
      width: '9rem',
      show: true,
      sortable: true,
      filterable: false,
      resizeable: true,
    },
  ];
};
