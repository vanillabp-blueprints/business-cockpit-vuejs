import { ref } from 'vue';
import type { UserTask } from '../generated/official-gui-api/types.gen';

/** The user task whose page is open, so the application header can take the look of its state. */
export const openTask = ref<UserTask>();
