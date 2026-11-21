export const userTaskListColumns = (userTask) => {
  if (userTask.workflowModuleId !== 'react-module') return undefined;
  return [
    {
      title: { de: 'Bestellnummer', en: 'Order number' },
      path: 'details.orderNumber',
      type: 'value',
      priority: 10,
      width: '9rem',
      show: true,
      sortable: true,
      filterable: true,
      resizeable: true,
    },
  ];
};
