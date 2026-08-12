/**
 * Default shift selection for a labourer.
 *
 * Factory policy: male workers default to the 12-hour shift, female workers
 * to the 9-hour shift. This is a DEFAULT, not a lock -- the shift dropdown in
 * the Add/Edit Attendance dialog stays editable, so any individual entry can
 * be set to either shift regardless of what this returns.
 *
 * Worth knowing, since it affects money: per-day salary is rate x shift
 * hours, so a 12-hour default produces a higher daily figure than a 9-hour
 * one at the same hourly rate. The hourly rate itself is per-employee and
 * untouched by this.
 */

export type ShiftType = '9-hour' | '12-hour';

export const MALE_DEFAULT_SHIFT: ShiftType = '12-hour';
export const FEMALE_DEFAULT_SHIFT: ShiftType = '9-hour';
export const FALLBACK_SHIFT: ShiftType = '9-hour';

/** Hours credited for a shift type. Mirrors the payroll calculation. */
export function hoursForShift(shift: ShiftType): number {
  return shift === '12-hour' ? 12 : 9;
}

function normalise(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

/**
 * The shift to preselect when a labourer is chosen.
 *
 * Resolution order:
 *   1. gender "male"   -> 12-hour
 *   2. gender "female" -> 9-hour
 *   3. anything else ("other", blank, missing, or an unrecognised value) ->
 *      the employee's own saved profile shift, which is the most specific
 *      information available once the gender rule doesn't apply
 *   4. nothing usable at all -> 9-hour, the shorter shift, so an unknown
 *      never silently inflates a day's pay
 */
export function defaultShiftForEmployee(
  employee?: { gender?: string | null; shift?: string | null } | null
): ShiftType {
  if (!employee) return FALLBACK_SHIFT;

  const gender = normalise(employee.gender);
  if (gender === 'male') return MALE_DEFAULT_SHIFT;
  if (gender === 'female') return FEMALE_DEFAULT_SHIFT;

  const profileShift = normalise(employee.shift);
  if (profileShift === '12-hour') return '12-hour';
  if (profileShift === '9-hour') return '9-hour';

  return FALLBACK_SHIFT;
}
