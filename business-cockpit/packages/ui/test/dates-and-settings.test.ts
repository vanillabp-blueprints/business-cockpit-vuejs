import { describe, expect, it, vi } from 'vitest';
import { dateCellOf, formatDateAndTime } from '../src/i18n/translation';
import { createSettingsService, settingKey } from '../src/settings/settings-service';

describe('TL-018 COL-019 the date cell', () => {
  const now = new Date('2026-11-21T12:00:00');

  it('shows the time when the date is today and the whole date on mouse-over', () => {
    const cell = dateCellOf('en', new Date('2026-11-21T09:30:00'), now);
    expect(cell.shown).toBe('9:30 AM');
    expect(cell.onMouseOver).toBe('Nov 21, 2026 9:30 AM');
  });

  it('shows the date when the date is not today', () => {
    expect(dateCellOf('de', new Date('2026-11-20T09:30:00'), now).shown).toBe('20.11.2026');
  });

  it('puts a space between the date and the time and never shows the T of ISO 8601', () => {
    expect(formatDateAndTime('de', '2027-03-04T14:05:00')).toBe('04.03.2027 14:05');
  });
});

describe('SET-005 the keys of the settings', () => {
  it('use colons and replace the dots of a path', () => {
    expect(settingKey('tasks', 'primaryFilter')).toBe('bc:tasks:primaryFilter');
    expect(settingKey('columns', 'tasks', 'width', 'details.customer.name')).toBe('bc:columns:tasks:width:details:customer:name');
  });
});

describe('SET-002 SET-006 the settings service', () => {
  const anApi = (stored: Record<string, unknown> = {}) => ({
    getSettingOfCurrentUser: vi.fn(async ({ key }: { key: string }) => {
      if (!(key in stored)) throw new Error('404');
      return stored[key];
    }),
    putSettingOfCurrentUser: vi.fn(async () => undefined),
  });

  it('asks the server once per key and answers the rest from the cache', async () => {
    const api = anApi({ 'bc:tasks:primaryFilter': 'ClosedTasksOnly' });
    const service = createSettingsService(api as never);
    expect(await service.read('bc:tasks:primaryFilter')).toBe('ClosedTasksOnly');
    expect(await service.read('bc:tasks:primaryFilter')).toBe('ClosedTasksOnly');
    expect(api.getSettingOfCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('answers nothing for a key the user never set', async () => {
    expect(await createSettingsService(anApi() as never).read('bc:unknown')).toBeUndefined();
  });

  it('updates the cache and writes to the server at once', async () => {
    const api = anApi();
    const service = createSettingsService(api as never);
    service.write('bc:a', 1);
    expect(await service.read('bc:a')).toBe(1);
    expect(api.putSettingOfCurrentUser).toHaveBeenCalledWith({ key: 'bc:a', body: 1 });
    expect(api.getSettingOfCurrentUser).not.toHaveBeenCalled();
  });

  it('writes a setting that changes often only after the change has stopped', () => {
    vi.useFakeTimers();
    const api = anApi();
    const service = createSettingsService(api as never);
    service.writeWhenTheChangeHasStopped('bc:width', 100, 500);
    service.writeWhenTheChangeHasStopped('bc:width', 120, 500);
    vi.advanceTimersByTime(499);
    expect(api.putSettingOfCurrentUser).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(api.putSettingOfCurrentUser).toHaveBeenCalledTimes(1);
    expect(api.putSettingOfCurrentUser).toHaveBeenCalledWith({ key: 'bc:width', body: 120 });
    vi.useRealTimers();
  });
});
