/**
 * Wage snapshots: an attendance row's `rate` is HISTORY, not a live lookup.
 *
 * THE RULE: the `rate` stored on an attendance row is the wage that was in
 * force when that period was worked. It is never rewritten from the employee
 * master. A labourer on Rs.620/day (rate 51.667 x 12h) who gets a Rs.55/day
 * increment to Rs.675/day (rate 56.25 x 12h) must still show Rs.620/day for
 * every month already worked and finalised. The increment applies to periods
 * entered from now on, because a new attendance row snapshots the employee's
 * rate at the moment it is created.
 *
 * WHAT THIS FIXES: the attendance screen used to refresh every row from the
 * employee record on load:
 *
 *     if (emp.rate !== entry.rate || emp.name !== entry.name || ...)
 *       return { ...entry, rate: emp.rate, name: emp.name, role: emp.role };
 *
 * across the FULL set -- every month, every year. So one wage change silently
 * re-priced all of history. It was latent on load (the provider-echo guard
 * stops that array being pushed straight back), but the next edit to any row
 * saved the whole set, writing the new rate over closed months. A finalised
 * June, already paid by voucher at the old rate, would have started reporting
 * the new one -- attendance disagreeing with the money that actually went out.
 *
 * Name and role are different: they are labels, carry no money, and a
 * corrected spelling should appear everywhere. Those still refresh.
 *
 * Rows with no stored rate are left alone rather than stamped here -- they
 * fall back to the employee rate inside calculateEntryBreakdown, which is the
 * documented behaviour for "not recorded". Inventing a snapshot for them would
 * be writing data the supervisor never entered.
 */

export interface WageEmployee {
  id?: string;
  name?: string;
  role?: string;
  /** Per-hour rate currently on the employee master. */
  rate?: number;
}

export interface WageEntry {
  name?: string;
  role?: string;
  /** Per-hour rate snapshotted when this row was created. */
  rate?: number;
}

/**
 * Refreshes an entry's cosmetic labels from the employee record.
 *
 * Deliberately does NOT touch `rate`. Returns the SAME object reference when
 * nothing changed, so callers can use identity to skip a re-render and avoid
 * handing the provider an array that only looks new.
 */
export function refreshEntryLabels<T extends WageEntry>(entry: T, employee?: WageEmployee | null): T {
  if (!employee) return entry;

  const nameChanged = employee.name !== undefined && employee.name !== entry.name;
  const roleChanged = employee.role !== undefined && employee.role !== entry.role;
  if (!nameChanged && !roleChanged) return entry;

  return {
    ...entry,
    ...(nameChanged ? { name: employee.name } : {}),
    ...(roleChanged ? { role: employee.role } : {}),
  };
}

/**
 * Whether this row was priced at a different wage than the employee is on now.
 *
 * Used to surface the difference in the UI instead of hiding it: a supervisor
 * looking at a closed month should be able to see "this was paid at the old
 * rate" rather than wonder why the figure does not match today's wage.
 *
 * Only true when BOTH rates are real numbers -- a missing or zero entry rate
 * means "not recorded" and falls back to the employee rate, so there is no
 * drift to report.
 */
export function hasRateDrift(entry: WageEntry, employee?: WageEmployee | null): boolean {
  if (!employee) return false;
  const entryRate = Number(entry.rate);
  const currentRate = Number(employee.rate);
  if (!Number.isFinite(entryRate) || entryRate <= 0) return false;
  if (!Number.isFinite(currentRate) || currentRate <= 0) return false;
  return entryRate !== currentRate;
}

/* ------------------------------------------------------------------ */
/* Choosing which wage a new row is entered at                         */
/* ------------------------------------------------------------------ */

export interface RatedEntry {
  employeeRefId?: string;
  id?: string;
  date?: string;
  rate?: number;
  shift?: string;
}

export interface PreviousRate {
  /** The per-hour rate this labourer was previously paid at. */
  rate: number;
  /** The date of the row it came from, so the UI can name the period. */
  date?: string;
  /** That row's shift -- the per-day figure depends on it. */
  shift?: string;
}

/** Rows belonging to one employee, matching the app's usual id fallback. */
function belongsTo(entry: RatedEntry, employeeId: string): boolean {
  if (entry.employeeRefId) return entry.employeeRefId === employeeId;
  if (entry.id === employeeId) return true;
  return !!entry.id && entry.id.split("-")[0] === employeeId;
}

/**
 * The wage this labourer was on BEFORE their current one, taken from the most
 * recent attendance row that was priced differently.
 *
 * There is no wage-history table, and there does not need to be: every
 * attendance row already carries the rate it was worked at, so the last row
 * priced differently IS the previous wage, dated. That keeps a single source
 * of truth rather than a second table to drift out of step.
 *
 * Why it matters: the attendance screen defaults to the PREVIOUS month (the
 * factory enters arrears), while a new row snapshots the employee's CURRENT
 * rate. Straight after an increment those disagree -- last month's attendance
 * would be entered at this month's wage. This gives the supervisor the older
 * figure to choose instead.
 *
 * Returns null when there is nothing older to offer.
 */
export function previousRateFor(
  employeeId: string,
  entries: RatedEntry[] | undefined,
  currentRate: number | undefined
): PreviousRate | null {
  const current = Number(currentRate);
  const candidates = (entries ?? [])
    .filter(e => belongsTo(e, employeeId))
    .filter(e => {
      const r = Number(e.rate);
      return Number.isFinite(r) && r > 0 && r !== current;
    });

  if (candidates.length === 0) return null;

  // Most recent first. Dates are YYYY-MM-DD (sometimes a "from to to" range),
  // so a plain string compare orders them correctly; rows without a date sort
  // last rather than winning by accident.
  const newest = candidates.reduce((best, e) =>
    (e.date || "") > (best.date || "") ? e : best
  );

  return { rate: Number(newest.rate), date: newest.date, shift: newest.shift };
}

/**
 * Refreshes labels across a whole set, preserving array identity when no row
 * changed. The attendance screen holds the full canonical set (every month) in
 * one array, so returning a new array for nothing would defeat the guard that
 * distinguishes a real local edit from a provider echo.
 */
export function refreshEntryLabelsAll<T extends WageEntry & { employeeRefId?: string; id?: string }>(
  entries: T[],
  employees: WageEmployee[] | undefined,
  findEmployee: (entry: T) => WageEmployee | undefined
): T[] {
  if (!entries || entries.length === 0) return entries;
  let changed = false;
  const next = entries.map(entry => {
    const refreshed = refreshEntryLabels(entry, findEmployee(entry));
    if (refreshed !== entry) changed = true;
    return refreshed;
  });
  return changed ? next : entries;
}
