import { UserSettingsApi } from '../generated/cockpit-gui-api/sdk.gen';

const userSettings = new UserSettingsApi();

/** Every key of the user interface starts with this, so it never meets a key of somebody else. */
const KEY_PREFIX = 'bc';

/** The server refuses a key with a dot, so a part of a key that comes from a path has its dots replaced. */
export function settingKey(...parts: string[]): string {
  return [KEY_PREFIX, ...parts.map((part) => part.replaceAll('.', ':'))].join(':');
}

/**
 * Settings that change many times in a row, like the width of a column while it is dragged, wait
 * this long without a change before they are written.
 */
export const QUIET_TIME_BEFORE_WRITING_MS = 800;

/** The one place that reads and writes the settings of the user. Nothing else calls the endpoints. */
export function createSettingsService(api: Pick<UserSettingsApi, 'getSettingOfCurrentUser' | 'putSettingOfCurrentUser'> = userSettings) {
  const cache = new Map<string, Promise<unknown>>();
  const waitingToBeWritten = new Map<string, ReturnType<typeof setTimeout>>();

  function writeToServer(key: string, value: unknown): void {
    // A setting that cannot be saved is lost on the next browser only. It never stops the work of the user.
    api.putSettingOfCurrentUser({ key, body: value }).catch(() => undefined);
  }

  return {
    /** Asks the server the first time a key is wanted and answers every later question from memory. */
    read<Value>(key: string): Promise<Value | undefined> {
      if (!cache.has(key)) {
        cache.set(
          key,
          api.getSettingOfCurrentUser({ key }).then(
            (value) => value ?? undefined,
            // 404 is how the server says that the user never chose anything.
            () => undefined,
          ),
        );
      }
      return cache.get(key) as Promise<Value | undefined>;
    },

    /** The cache changes at once, so the page does not wait for the server. */
    write(key: string, value: unknown): void {
      cache.set(key, Promise.resolve(value));
      writeToServer(key, value);
    },

    writeWhenTheChangeHasStopped(key: string, value: unknown, quietTimeMs = QUIET_TIME_BEFORE_WRITING_MS): void {
      cache.set(key, Promise.resolve(value));
      clearTimeout(waitingToBeWritten.get(key));
      waitingToBeWritten.set(
        key,
        setTimeout(() => {
          waitingToBeWritten.delete(key);
          writeToServer(key, value);
        }, quietTimeMs),
      );
    },
  };
}

export const settings = createSettingsService();
