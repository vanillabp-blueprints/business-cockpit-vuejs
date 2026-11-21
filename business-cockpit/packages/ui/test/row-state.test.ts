import { describe, expect, it } from 'vitest';
import { rowStateOf } from '../src/lists/row-state';

const MOMENT = '2026-11-01T08:00:00Z';

describe('rowStateOf', () => {
  it('is active without end and without suspension', () => {
    expect(rowStateOf({})).toBe('active');
  });
  it('is completed or cancelled as endReason says', () => {
    expect(rowStateOf({ endedAt: MOMENT, endReason: 'COMPLETED' })).toBe('completed');
    expect(rowStateOf({ endedAt: MOMENT, endReason: 'CANCELLED' })).toBe('cancelled');
  });
  it('is suspended only without an end', () => {
    expect(rowStateOf({ suspendedAt: MOMENT })).toBe('suspended');
    expect(rowStateOf({ suspendedAt: MOMENT, endedAt: MOMENT, endReason: 'CANCELLED' })).toBe('cancelled');
  });
});
