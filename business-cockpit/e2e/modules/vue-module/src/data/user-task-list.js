export const userTaskListColumns = (userTask) => {
  if (userTask.workflowModuleId !== 'vue-module') return undefined;
  return [
    {
      title: { de: 'Kreditsumme', en: 'Loan amount' },
      path: 'details.loanAmount',
      type: 'value',
      priority: 20,
      width: '8rem',
      show: true,
      sortable: true,
      filterable: false,
      resizeable: true,
    },
  ];
};
