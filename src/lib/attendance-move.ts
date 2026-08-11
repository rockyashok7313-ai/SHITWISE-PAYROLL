/**
 * Moving a batch of attendance records from one month to another.
 *
 * This is a deliberate, user-triggered, one-time correction tool -- NOT the
 * same thing as the bug that used to silently reassign every attendance
 * row's date to whatever month the screen happened to be showing. The
 * difference that matters: this only runs when explicitly invoked with an
 * explicit from/to period, it operates on a caller-supplied snapshot rather
 * than reacting to every render, and the UI wraps it in a preview + confirm
 * step (see components/settings/move-attendance-period.tsx). This module is
 * just the pure planning logic, so that logic is what's actually tested
 * rather than trusted by inspection.
 */

import { MONTHS, isInSelectedPeriod, lastDayOfMonth } from './attendance-period';

export interface MovableEntry {
  id: string;
  date: string;
  employeeRefId?: string;
}

/** Shifts one "YYYY-MM-DD" piece into the target month, clamping the day if
 *  the target month is shorter (e.g. July 31 -> June clamps to June 30).
 *  Left unchanged if it doesn't parse as a date. */
function shiftDatePart(datePart: string, toYear: number, toMonth1to12: number): string {
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return datePart;
  const clampedDay = Math.min(d, lastDayOfMonth(toYear, toMonth1to12));
  return `${toYear}-${String(toMonth1to12).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Shifts an entry's date field into the target month. Handles both a plain
 * "YYYY-MM-DD" and the "YYYY-MM-DD to YYYY-MM-DD" range format multi-day
 * entries use (see handleAddAttendance) -- both ends get shifted, each
 * clamped independently.
 */
export function moveEntryDate(dateStr: string, toYear: number, toMonth1to12: number): string {
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    return `${shiftDatePart(start.trim(), toYear, toMonth1to12)} to ${shiftDatePart(end.trim(), toYear, toMonth1to12)}`;
  }
  return shiftDatePart(dateStr.trim(), toYear, toMonth1to12);
}

export interface PeriodMoveConflict<T> {
  moving: T;
  newDate: string;
  /** The existing (not being moved) record already at that employee+date. */
  collidesWith: T;
}

export interface PeriodMovePlan<T extends MovableEntry> {
  /** The full set with the from-period entries' dates shifted -- what to
   *  hand to handleAttendanceChange if the move is confirmed. Everything not
   *  in the from period is returned completely untouched (same references). */
  result: T[];
  /** The entries that would move, already shifted to their new date -- what
   *  to show in a preview. */
  moved: T[];
  /** Same-employee collisions the move would create at the destination.
   *  Detected, never silently resolved -- the caller decides what to do. */
  conflicts: PeriodMoveConflict<T>[];
}

function employeeKey(e: MovableEntry): string {
  return e.employeeRefId || e.id.split('-')[0];
}

/**
 * Plans moving every entry in `fromMonth`/`fromYear` into `toMonth`/`toYear`.
 * Pure: does not mutate `entries` and does not talk to any store. Nothing is
 * moved unless the caller uses `result`.
 */
export function planPeriodMove<T extends MovableEntry>(
  entries: T[],
  fromMonth: string,
  fromYear: string,
  toMonth: string,
  toYear: string
): PeriodMovePlan<T> {
  const toMonthNum = MONTHS.indexOf(toMonth) + 1;
  const toYearNum = parseInt(toYear, 10);

  const moving = (entries ?? []).filter(e => isInSelectedPeriod(e, fromMonth, fromYear));
  const movingIds = new Set(moving.map(e => e.id));
  const staying = (entries ?? []).filter(e => !movingIds.has(e.id));

  const moved: T[] = [];
  const conflicts: PeriodMoveConflict<T>[] = [];

  for (const entry of moving) {
    const newDate = moveEntryDate(entry.date, toYearNum, toMonthNum);
    const updated = { ...entry, date: newDate, isModified: true } as T;
    moved.push(updated);

    const collision = staying.find(s => employeeKey(s) === employeeKey(entry) && s.date === newDate);
    if (collision) conflicts.push({ moving: updated, newDate, collidesWith: collision });
  }

  return { result: [...staying, ...moved], moved, conflicts };
}
