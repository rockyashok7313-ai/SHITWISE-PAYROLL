import { describe, it, expect } from 'vitest';
import { defaultShiftForEmployee, hoursForShift } from '../../src/lib/shift-rules';

describe('defaultShiftForEmployee', () => {
  it('gives 12-hour for male', () => {
    expect(defaultShiftForEmployee({ gender: 'male' })).toBe('12-hour');
  });

  it('gives 9-hour for female', () => {
    expect(defaultShiftForEmployee({ gender: 'female' })).toBe('9-hour');
  });

  it('is not confused by casing or stray whitespace from stored data', () => {
    expect(defaultShiftForEmployee({ gender: 'Male' })).toBe('12-hour');
    expect(defaultShiftForEmployee({ gender: ' FEMALE ' })).toBe('9-hour');
  });

  it('gender wins over the profile shift when it is male or female', () => {
    // The whole point of the feature: picking the labourer re-derives the
    // shift from gender rather than echoing whatever the profile happens to say.
    expect(defaultShiftForEmployee({ gender: 'male', shift: '9-hour' })).toBe('12-hour');
    expect(defaultShiftForEmployee({ gender: 'female', shift: '12-hour' })).toBe('9-hour');
  });

  describe('when the gender rule does not apply', () => {
    it('falls back to the employee\'s own profile shift for "other"', () => {
      expect(defaultShiftForEmployee({ gender: 'other', shift: '12-hour' })).toBe('12-hour');
      expect(defaultShiftForEmployee({ gender: 'other', shift: '9-hour' })).toBe('9-hour');
    });

    it('falls back to the profile shift when gender is blank or missing', () => {
      expect(defaultShiftForEmployee({ gender: '', shift: '12-hour' })).toBe('12-hour');
      expect(defaultShiftForEmployee({ shift: '12-hour' })).toBe('12-hour');
      expect(defaultShiftForEmployee({ gender: null, shift: '12-hour' })).toBe('12-hour');
    });

    it('falls back to the SHORTER shift when nothing usable is known', () => {
      // 9-hour on purpose: an unknown must never silently inflate a day's pay.
      expect(defaultShiftForEmployee({})).toBe('9-hour');
      expect(defaultShiftForEmployee({ gender: 'other' })).toBe('9-hour');
      expect(defaultShiftForEmployee({ gender: 'other', shift: 'garbage' })).toBe('9-hour');
      expect(defaultShiftForEmployee(null)).toBe('9-hour');
      expect(defaultShiftForEmployee(undefined)).toBe('9-hour');
    });
  });
});

describe('hoursForShift', () => {
  it('credits 12 hours for a 12-hour shift and 9 otherwise', () => {
    expect(hoursForShift('12-hour')).toBe(12);
    expect(hoursForShift('9-hour')).toBe(9);
  });
});
