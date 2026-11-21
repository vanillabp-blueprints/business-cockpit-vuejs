import { describe, expect, it } from 'vitest';
import { initialsOf, shortNameOf } from '../src/session/person';

describe('NAV-011 the badge shows the initials of the long form of the name, or of the user id', () => {
  it('takes the first letter of the first and of the last word of the long form', () => {
    expect(initialsOf({ id: 'clerk', display: 'Clara Maria Clerk' })).toBe('CC');
  });

  it('takes the user id when there is no long form', () => {
    expect(initialsOf({ id: 'clara.clerk' })).toBe('CC');
    expect(initialsOf({ id: 'clerk' })).toBe('C');
  });

  it('shows the short form, else the long form, else the user id', () => {
    expect(shortNameOf({ id: 'clerk', display: 'Clara Clerk', displayShort: 'C. Clerk' })).toBe('C. Clerk');
    expect(shortNameOf({ id: 'clerk', display: 'Clara Clerk' })).toBe('Clara Clerk');
    expect(shortNameOf({ id: 'clerk' })).toBe('clerk');
  });
});
