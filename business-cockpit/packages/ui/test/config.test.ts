import { describe, expect, it } from 'vitest';
import { DEFAULT_GUI_API_BASE_PATH, guiApiBasePath } from '../src/config';

function pageWithMeta(content: string | null) {
  return {
    querySelector: () => (content === null ? null : { getAttribute: () => content }),
  } as unknown as Pick<Document, 'querySelector'>;
}

describe('PKG-055 the base path of the GUI API is one configuration value', () => {
  it('is /gui/api/v1 by default', () => {
    expect(guiApiBasePath(pageWithMeta(null))).toBe('/gui/api/v1');
    expect(DEFAULT_GUI_API_BASE_PATH).toBe('/gui/api/v1');
  });

  it('can be set by the page', () => {
    expect(guiApiBasePath(pageWithMeta('/official-api/gui/api/v1'))).toBe('/official-api/gui/api/v1');
  });
});
