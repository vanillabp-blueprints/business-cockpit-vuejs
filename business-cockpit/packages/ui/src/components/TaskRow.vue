<template>
  <div
    class="task-row"
    :class="{ 'task-row--unread': !task.read }"
    :style="{ gridTemplateColumns: gridTemplate, height: `${ROW_HEIGHT_PX}px` }"
    data-testid="task-row"
    :data-task-id="task.id"
  >
    <template v-for="column in columns" :key="column.key">
      <div v-if="column.key === 'select'" class="task-cell task-cell--icon">
        <v-checkbox-btn
          :model-value="isSelected"
          :aria-label="text('columns.select')"
          density="compact"
          data-testid="select-task"
          @update:model-value="$emit('select', $event as boolean)"
        />
      </div>

      <div v-else-if="column.key === 'title'" class="task-cell">
        <router-link :to="pathOfTask(task.id, language)" data-testid="task-title">{{ translated(task.title) }}</router-link>
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
        <template v-if="task.candidateUsers?.length">
          <v-icon :icon="task.candidateUsers.length > 1 ? mdiAccountMultiple : mdiAccount" size="small" data-testid="candidate-icon" />
          <v-tooltip activator="parent" location="bottom" interactive>
            <div v-for="person in task.candidateUsers" :key="person.id" data-testid="candidate-user">
              <person-name :person="person" />
            </div>
          </v-tooltip>
        </template>
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
import { gridTemplateOf, type TaskColumn } from '../lists/task-columns';
import { pathOfTask } from '../router/screens';
import { currentUser } from '../session/session';
import DateCell from './DateCell.vue';
import PersonName from './PersonName.vue';

const props = defineProps<{ task: UserTask; columns: TaskColumn[]; isSelected: boolean }>();
defineEmits<{ select: [isSelected: boolean] }>();

const { text, language, translated } = useTexts();

// The three date columns are the only ones that reach this branch of the template.
const momentOf = (key: string) => (props.task as unknown as Record<string, string | undefined>)[key];

const gridTemplate = computed(() => gridTemplateOf(props.columns));
const isClaimedByCurrentUser = computed(() => props.task.assignee?.id === currentUser.value?.id);
</script>

<style scoped>
.task-row {
  display: grid;
  align-items: center;
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
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
