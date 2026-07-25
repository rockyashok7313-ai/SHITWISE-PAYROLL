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
