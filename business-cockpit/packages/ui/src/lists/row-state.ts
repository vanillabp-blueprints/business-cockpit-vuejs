import type { UserTask } from '../generated/official-gui-api/types.gen';

export type RowState = 'active' | 'completed' | 'cancelled' | 'suspended';

/**
 * The end decides before the suspension: a task that was cancelled while it was suspended keeps its
 * `suspendedAt`, but it is over and looks cancelled.
 */
export function rowStateOf(task: Pick<UserTask, 'endedAt' | 'endReason' | 'suspendedAt'>): RowState {
  if (task.endedAt) return task.endReason === 'CANCELLED' ? 'cancelled' : 'completed';
  if (task.suspendedAt) return 'suspended';
  return 'active';
}
