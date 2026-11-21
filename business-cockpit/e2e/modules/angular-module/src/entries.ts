// The entry point of the build. The cockpit never loads this file. The Angular CLI writes one file for each
// import() below, with the hash of its content in the name, and builds.mjs names them in the manifest.
export const entries = {
  UserTaskList: () => import('./data/user-task-list'),
  WorkflowList: () => import('./data/workflow-list'),
  UserTaskForm: () => import('./data/user-task-form'),
  ClaimForms: () => import('./forms/claim-forms'),
};
