import { onBeforeUnmount, onMounted } from 'vue';

const CHANNEL_NAME = 'bc-cockpit';
const LIST_WINDOW_NAME = 'bc-list';

/**
 * A list page answers the question "is a list alive?" of a task page, over a BroadcastChannel. A
 * BroadcastChannel needs no window object, so it also works after the task page was reloaded. The answer
 * carries `document.visibilityState`, because `hasFocus()` is not trusted in a tab in the background.
 */
export function answerWhenAskedIfListIsAlive(): void {
  let channel: BroadcastChannel | undefined;
  onMounted(() => {
    // The name finds this window again when the window object of the task page is gone.
    window.name = LIST_WINDOW_NAME;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (message: MessageEvent) => {
      if (message.data?.type === 'list-ping') {
        channel?.postMessage({ type: 'list-pong', id: message.data.id, visible: document.visibilityState === 'visible' });
      }
    };
  });
  onBeforeUnmount(() => channel?.close());
}
