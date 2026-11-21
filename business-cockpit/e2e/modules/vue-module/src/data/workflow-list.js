export const workflowListColumns = (workflow) => {
  if (workflow.workflowModuleId !== 'vue-module') return undefined;
  return [
    {
      title: { de: 'Kunde', en: 'Customer' },
      path: 'details.customer',
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
