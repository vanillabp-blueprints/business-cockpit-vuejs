import type { UserTask } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';

let counter = 0;

/** A user task as the GUI API answers it. A test names only what it cares about. */
export function aTask(overrides: Partial<UserTask> = {}): UserTask {
  counter++;
  const id = overrides.id ?? `task-${String(counter).padStart(4, '0')}`;
  return {
    id,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
    workflowModuleId: 'orders',
    bpmnProcessId: 'order-handling',
    workflowTitle: { de: 'Bestellung', en: 'Order' },
    title: { de: `Aufgabe ${id}`, en: `Task ${id}` },
    taskDefinition: 'check-order',
    uiUri: '/remoteEntry.js',
    uiUriType: 'ES_MODULES',
    workflowModuleUri: '/wm/orders',
    read: '2026-11-01T09:00:00Z',
    ...overrides,
  };
}

export const clerkPerson = { id: 'clerk', display: 'Clara Clerk', displayShort: 'C. Clerk', email: 'clerk@example.com' };
export const otherPerson = { id: 'olaf', display: 'Olaf Other', displayShort: 'O. Other', email: 'olaf@example.com' };
