<template>
  <div
    class="task-row"
    :class="[`task-row--${state}`, { 'task-row--unread': !task.read }]"
    :style="{ gridTemplateColumns: gridTemplate, height: `${ROW_HEIGHT_PX}px` }"
    data-testid="task-row"
    :data-task-id="task.id"
    :data-state="state"
  >
    <template v-for="column in columns" :key="column.key">
      <div v-if="column.key === 'select'" class="task-cell task-cell--icon">
        <!-- A plain checkbox: a component library draws about ten elements for one, in every row. -->
        <label class="select-task" data-testid="select-task">
          <input
            type="checkbox"
            :checked="isSelected"
            :aria-label="text('columns.select')"
            @change="$emit('select', ($event.target as HTMLInputElement).checked)"
          />
        </label>
      </div>

      <div v-else-if="column.key === 'title'" class="task-cell">
        <!-- A task with a page of its own opens in a tab of its own, and the list stays where it is. -->
        <a v-if="wayToOpen(task) === 'own-tab'" :href="addressOfTask(task)" target="_blank" rel="noopener" data-testid="task-title">{{ translated(task.title) }}</a>
        <router-link v-else :to="pathOfTask(task.id, language)" data-testid="task-title">{{ translated(task.title) }}</router-link>
      </div>

      <div v-else-if="column.key === 'caseKind'" class="task-cell" data-testid="cell-caseKind">
        {{ translated(task.workflowTitle) }}
      </div>

      <div v-else-if="column.key === 'note'" class="task-cell" data-testid="cell-note">
        <span class="task-cell__note" :title="task.note">{{ task.note }}</span>
      </div>

      <div v-else-if="column.key === 'assignee'" class="task-cell" data-testid="cell-assignee">
        <!-- The bar has its place also without a claim, so all names stand at the same left edge. -->
        <span class="claim-bar" :class="{ 'claim-bar--mine': isClaimedByCurrentUser }" data-testid="claim-bar" />
        <person-name v-if="task.assignee" :person="task.assignee" />
      </div>

      <div v-else-if="column.key === 'candidateUsers'" class="task-cell task-cell--icon" data-testid="cell-candidateUsers">
        <hover-tooltip v-if="task.candidateUsers?.length" interactive>
          <v-icon :icon="task.candidateUsers.length > 1 ? mdiAccountMultiple : mdiAccount" size="small" data-testid="candidate-icon" />
          <template #tip>
            <div v-for="person in task.candidateUsers" :key="person.id" data-testid="candidate-user">
              <person-name :person="person" />
            </div>
          </template>
        </hover-tooltip>
      </div>

      <div v-else class="task-cell" :data-testid="`cell-${column.key}`">
        <date-cell :moment="momentOf(column.key)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { mdiAccount, mdiAccountMultiple } from '@mdi/js';
import type { UserTask } from '../generated/official-gui-api/types.gen';
import { useTexts } from '../i18n/texts';
import { ROW_HEIGHT_PX } from '../lists/list-constants';
import { rowStateOf } from '../lists/row-state';
import { gridTemplateOf, type TaskColumn } from '../lists/task-columns';
import { addressOfTask, wayToOpen } from '../modules/task-address';
import { pathOfTask } from '../router/screens';
import { currentUser } from '../session/session';
import DateCell from './DateCell.vue';
import HoverTooltip from './HoverTooltip.vue';
import PersonName from './PersonName.vue';

const props = defineProps<{ task: UserTask; columns: TaskColumn[]; isSelected: boolean }>();
defineEmits<{ select: [isSelected: boolean] }>();

const { text, language, translated } = useTexts();

// The three date columns are the only ones that reach this branch of the template.
const momentOf = (key: string) => (props.task as unknown as Record<string, string | undefined>)[key];

const state = computed(() => rowStateOf(props.task));
const gridTemplate = computed(() => gridTemplateOf(props.columns));
const isClaimedByCurrentUser = computed(() => props.task.assignee?.id === currentUser.value?.id);
</script>

<style scoped>
.task-row {
  /* The list puts each row where it belongs in the whole list, see `top` of the list. */
  position: absolute;
  left: 0;
  right: 0;
  box-sizing: border-box;
  display: grid;
  align-items: center;
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
}
.task-row--completed,
.task-row--cancelled {
  background: var(--bc-color-row-ended);
}
/* Only the title is struck through, not the other cells. */
.task-row--cancelled a {
  text-decoration: line-through;
}
.task-row--suspended,
.task-row--suspended a {
  color: var(--bc-color-text-suspended);
}
.task-row--unread {
  font-weight: 700;
}
.task-cell {
  display: flex;
  align-items: center;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.task-cell--icon {
  justify-content: center;
  padding: 0;
}
.task-cell__note {
  overflow: hidden;
  text-overflow: ellipsis;
}
.select-task {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.select-task input {
  width: 18px;
  height: 18px;
  accent-color: rgb(var(--v-theme-primary));
}
.claim-bar {
  flex: none;
  width: 3px;
  height: 1.4em;
  margin-right: 6px;
  background: transparent;
}
.claim-bar--mine {
  background: rgb(var(--v-theme-primary));
}
</style>
