/**
 * Merge-based sync for records shared between localStorage and Supabase.
 *
 * The old model compared array LENGTHS: whichever side had more rows won. That
 * cannot represent a deletion -- a shorter side looks "behind" and gets its
 * missing rows pushed back, so a voucher deleted on one machine reappears the
 * next time a machine with a stale cache syncs. For payment records that is a
 * resurrected payout.
 *
 * This merges per record, by id, using two fields every synced record carries:
 *
 *   updatedAt -- ISO timestamp of the last change; the version key.
 *   deletedAt -- ISO timestamp of deletion, or null. A tombstone: a delete is
 *                a value that propagates, not an absence that has to be inferred.
 *
 * The newer version of each id wins; a tombstone hides the record everywhere it
 * merges to. Nothing here talks to a store -- it is pure so the rules can be
 * tested exhaustively, which for a payments merge is not optional.
 */

export interface Syncable {
  id: string;
  /** ISO 8601. Missing/empty is treated as the oldest possible version. */
  updatedAt?: string | null;
  /** ISO 8601 tombstone, or null/absent for a live record. */
  deletedAt?: string | null;
}

/** Version key. A missing timestamp sorts before every real one. */
function version(r: Syncable): string {
  return r.updatedAt || '';
}

/**
 * The surviving version of one id, given the local and remote copies.
 *
 * Newer updatedAt wins. On an equal timestamp a tombstone wins over a live row
 * -- deletes are sticky, so a delete is never lost to a same-instant edit. On a
 * full tie the two are the same version; local is returned for determinism
 * (callers always pass local first).
 */
function pickWinner<T extends Syncable>(local: T, remote: T): T {
  const vl = version(local);
  const vr = version(remote);
  if (vl !== vr) return vl > vr ? local : remote;

  const deletedLocal = !!local.deletedAt;
  const deletedRemote = !!remote.deletedAt;
  if (deletedLocal !== deletedRemote) return deletedLocal ? local : remote;

  return local;
}

/**
 * Merges two record sets by id. Tombstones are retained in the result -- the
 * merged set is the full sync state, not the display set. Use `liveRecords` to
 * get what the UI should show, but persist the full merged set so deletions
 * keep propagating.
 */
export function mergeById<T extends Syncable>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of local ?? []) byId.set(r.id, r);
  for (const r of remote ?? []) {
    const existing = byId.get(r.id);
    byId.set(r.id, existing ? pickWinner(existing, r) : r);
  }
  return [...byId.values()];
}

/** The live records from a merged set: everything without a tombstone. */
export function liveRecords<T extends Syncable>(merged: T[]): T[] {
  return (merged ?? []).filter(r => !r.deletedAt);
}

/**
 * Whether two record sets are the same sync state: same ids, each with the same
 * updatedAt and deletedAt. Because reconcileBulk only bumps updatedAt when a
 * record actually changed, this is a cheap "did anything change?" check.
 *
 * The bulk handlers use it to skip the state update when a whole-array save
 * reconciled to no change -- which also breaks the render loop a component whose
 * load effect re-derives its array from the exposed (always-new) live view
 * would otherwise spin in.
 */
export function sameSyncState<T extends Syncable>(a: T[], b: T[]): boolean {
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
  const bById = new Map<string, T>((b ?? []).map(r => [r.id, r]));
  for (const r of a ?? []) {
    const o = bById.get(r.id);
    if (!o) return false;
    if ((r.updatedAt ?? null) !== (o.updatedAt ?? null)) return false;
    if ((r.deletedAt ?? null) !== (o.deletedAt ?? null)) return false;
  }
  return true;
}

/** Shallow content equality, ignoring the sync bookkeeping fields. Records here
 *  are flat (strings/numbers/booleans), so a shallow key-by-key compare is
 *  enough. Order-independent. */
function contentEqual<T extends Syncable>(a: T, b: T): boolean {
  const keys = new Set<string>();
  for (const k of Object.keys(a)) if (k !== 'updatedAt' && k !== 'deletedAt') keys.add(k);
  for (const k of Object.keys(b)) if (k !== 'updatedAt' && k !== 'deletedAt') keys.add(k);
  for (const k of keys) {
    if ((a as any)[k] !== (b as any)[k]) return false;
  }
  return true;
}

/**
 * Reconciles a bulk whole-array save into the merged model.
 *
 * Employees and attendance are edited by handing back the ENTIRE live array,
 * not per-record ops. To keep tombstones and stable versions, this diffs the
 * incoming live array against the previous full set (tombstones included):
 *
 *   - a record the previous set did not have  -> new, stamped `now`, live
 *   - a live record whose content is unchanged -> keeps its old `updatedAt`, so
 *     a whole-array save does NOT bump every row and clobber another machine's
 *     concurrent edit to a different row
 *   - a changed record, or one revived from a tombstone -> stamped `now`, live
 *   - a previously-live record absent from the incoming array -> tombstoned
 *   - an existing tombstone not re-added -> preserved
 *
 * `now` is passed in (not read from the clock) so the result is deterministic
 * and testable.
 */
export function reconcileBulk<T extends Syncable>(
  previous: T[],
  incomingLive: T[],
  now: string,
  isEqual: (a: T, b: T) => boolean = contentEqual
): T[] {
  const prevById = new Map<string, T>((previous ?? []).map(r => [r.id, r]));
  const incomingIds = new Set<string>((incomingLive ?? []).map(r => r.id));
  const result: T[] = [];

  for (const inc of incomingLive ?? []) {
    const prev = prevById.get(inc.id);
    if (prev && !prev.deletedAt && isEqual(prev, inc)) {
      result.push({ ...inc, updatedAt: prev.updatedAt ?? now, deletedAt: null });
    } else {
      result.push({ ...inc, updatedAt: now, deletedAt: null });
    }
  }

  for (const prev of previous ?? []) {
    if (incomingIds.has(prev.id)) continue;   // handled above
    if (prev.deletedAt) {
      result.push(prev);                       // keep existing tombstone
    } else {
      result.push({ ...prev, deletedAt: now, updatedAt: now });  // newly removed
    }
  }

  return result;
}

/**
 * Which merged records need writing back to remote: those remote is missing,
 * or has an older version of, or disagrees with on tombstone state. Records
 * where remote already matches are skipped so a sync is not a full re-upload.
 */
export function recordsToPush<T extends Syncable>(merged: T[], remote: T[]): T[] {
  const remoteById = new Map<string, T>((remote ?? []).map(r => [r.id, r]));
  return (merged ?? []).filter(m => {
    const r = remoteById.get(m.id);
    if (!r) return true;
    if (version(m) !== version(r)) return version(m) > version(r);
    return (!!m.deletedAt) !== (!!r.deletedAt);
  });
}
