import { ref, type Ref } from 'vue';
import { settingKey, settings } from '../settings/settings-service';
import { DEFAULT_TASK_PRIMARY_FILTER, isTaskPrimaryFilter, type TaskPrimaryFilter } from './primary-filters';
import { TASK_LIST_NAMES, type TaskListName } from './task-lists';

export const primaryFilterSettingKey = (list: TaskListName) => settingKey(list, 'primaryFilter');

const choiceOfList = Object.fromEntries(
  TASK_LIST_NAMES.map((list) => [list, ref<TaskPrimaryFilter>(DEFAULT_TASK_PRIMARY_FILTER)]),
) as Record<TaskListName, Ref<TaskPrimaryFilter>>;

/** The primary filter a list opens with: the one the user chose last, in any browser, else the default. */
export async function loadPrimaryFilterChoice(list: TaskListName): Promise<TaskPrimaryFilter> {
  const remembered = await settings.read<unknown>(primaryFilterSettingKey(list));
  choiceOfList[list].value = isTaskPrimaryFilter(remembered) ? remembered : DEFAULT_TASK_PRIMARY_FILTER;
  return choiceOfList[list].value;
}

export function choosePrimaryFilter(list: TaskListName, filter: TaskPrimaryFilter): void {
  choiceOfList[list].value = filter;
  settings.write(primaryFilterSettingKey(list), filter);
}

export const primaryFilterChoiceOf = (list: TaskListName): Readonly<Ref<TaskPrimaryFilter>> => choiceOfList[list];
