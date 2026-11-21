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

const MODULES = [
  { id: 'orders', process: 'order-handling', definition: 'check-order', title: { de: 'Bestellung', en: 'Order' }, taskTitle: 'Bestellung prüfen' },
  { id: 'loans', process: 'loan-approval', definition: 'assess-risk', title: { de: 'Kredit', en: 'Loan' }, taskTitle: 'Risiko bewerten' },
  { id: 'claims', process: 'claim-settlement', definition: 'review-claim', title: { de: 'Schadensfall', en: 'Claim' }, taskTitle: 'Schaden begutachten' },
  { id: 'onboarding', process: 'customer-onboarding', definition: 'verify-identity', title: { de: 'Neukunde', en: 'New customer' }, taskTitle: 'Identität prüfen' },
];

/**
 * Many tasks of four simulated modules, so the rows differ the way they do in production: other
 * titles and texts, some assigned, some proposed to several people, one in four closed, some
 * suspended, some with a follow-up date. The tasks are the same on every run.
 */
export function manyTasks(count: number): UserTask[] {
  const inTheFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return Array.from({ length: count }, (_, index) => {
    const module = MODULES[index % MODULES.length];
    const number = String(index).padStart(6, '0');
    const isClosed = index % 4 === 3;
    const day = String(1 + (index % 28)).padStart(2, '0');
    return aTask({
      id: `m-${number}`,
      workflowModuleId: module.id,
      bpmnProcessId: module.process,
      taskDefinition: module.definition,
      workflowTitle: module.title,
      title: { de: `${module.taskTitle} ${number}`, en: `${module.title.en} task ${number}` },
      createdAt: `2026-10-${day}T08:${String(index % 60).padStart(2, '0')}:00Z`,
      dueDate: index % 3 === 0 ? `2027-01-${day}T12:00:00Z` : undefined,
      note: index % 5 === 0 ? `Note ${number} of the module ${module.id}` : undefined,
      assignee: index % 7 === 0 ? clerkPerson : index % 11 === 0 ? otherPerson : undefined,
      candidateUsers: index % 6 === 0 ? [clerkPerson, otherPerson] : index % 13 === 0 ? [clerkPerson] : undefined,
      read: index % 9 === 0 ? undefined : '2026-11-01T09:00:00Z',
      followUpDate: !isClosed && index % 10 === 1 ? inTheFuture : undefined,
      suspendedAt: !isClosed && index % 17 === 0 ? '2026-11-02T08:00:00Z' : undefined,
      endedAt: isClosed ? '2026-11-05T08:00:00Z' : undefined,
      endReason: isClosed ? (index % 8 === 3 ? 'CANCELLED' : 'COMPLETED') : undefined,
    });
  });
}
