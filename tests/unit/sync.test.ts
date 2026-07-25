import { describe, it, expect } from 'vitest';
import type { Syncable } from '../../src/lib/sync';
import { mergeById, liveRecords, recordsToPush } from '../../src/lib/sync';

/* Timestamps as plain ISO strings; lexical order == chronological order. */
const T1 = '2027-05-01T10:00:00.000Z';
const T2 = '2027-05-02T10:00:00.000Z';
const T3 = '2027-05-03T10:00:00.000Z';

interface Rec extends Syncable {
  id: string;
  amount?: number;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

const byId = (recs: Rec[]) => Object.fromEntries(recs.map(r => [r.id, r]));

describe('mergeById', () => {
  it('unions records that exist on only one side', () => {
    const local: Rec[] = [{ id: 'A', updatedAt: T1 }];
    const remote: Rec[] = [{ id: 'B', updatedAt: T1 }];
    const merged = byId(mergeById(local, remote));
    expect(Object.keys(merged).sort()).toEqual(['A', 'B']);
  });

  it('keeps the newer version of a record present on both sides', () => {
    const local: Rec[] = [{ id: 'A', amount: 100, updatedAt: T2 }];
    const remote: Rec[] = [{ id: 'A', amount: 50, updatedAt: T1 }];
    expect(byId(mergeById(local, remote)).A.amount).toBe(100);   // local newer
    expect(byId(mergeById(remote, local)).A.amount).toBe(100);   // order-independent
  });

  it('lets remote win when it is newer', () => {
    const local: Rec[] = [{ id: 'A', amount: 100, updatedAt: T1 }];
    const remote: Rec[] = [{ id: 'A', amount: 50, updatedAt: T2 }];
    expect(byId(mergeById(local, remote)).A.amount).toBe(50);
  });

  describe('deletion propagation (the resurrection bug)', () => {
    it('does NOT resurrect a row deleted remotely after the local copy was written', () => {
      // Machine B deleted A (tombstone at T2). Machine A still has the live T1 copy.
      const localLive: Rec[] = [{ id: 'A', amount: 100, updatedAt: T1 }];
      const remoteTombstone: Rec[] = [{ id: 'A', amount: 100, updatedAt: T2, deletedAt: T2 }];

      const merged = mergeById(localLive, remoteTombstone);
      expect(byId(merged).A.deletedAt).toBe(T2);        // tombstone survives the merge
      expect(liveRecords(merged)).toHaveLength(0);       // and A is not shown
    });

    it('does NOT resurrect when the tombstone is the LOCAL copy and remote is a stale live row', () => {
      const localTombstone: Rec[] = [{ id: 'A', updatedAt: T2, deletedAt: T2 }];
      const remoteLive: Rec[] = [{ id: 'A', amount: 100, updatedAt: T1 }];

      const merged = mergeById(localTombstone, remoteLive);
      expect(byId(merged).A.deletedAt).toBe(T2);
      expect(liveRecords(merged)).toHaveLength(0);
    });

    it('a re-created row (newer than its tombstone) comes back to life', () => {
      // Deleted at T1, then a NEW edit/undelete at T2.
      const local: Rec[] = [{ id: 'A', amount: 200, updatedAt: T2, deletedAt: null }];
      const remote: Rec[] = [{ id: 'A', amount: 100, updatedAt: T1, deletedAt: T1 }];
      const merged = mergeById(local, remote);
      expect(byId(merged).A.deletedAt).toBeFalsy();
      expect(liveRecords(merged)).toHaveLength(1);
    });
  });

  describe('tie-breaking on equal updatedAt', () => {
    it('a tombstone beats a live row at the same timestamp (delete is sticky)', () => {
      const live: Rec[] = [{ id: 'A', amount: 100, updatedAt: T2 }];
      const dead: Rec[] = [{ id: 'A', amount: 100, updatedAt: T2, deletedAt: T2 }];
      expect(byId(mergeById(live, dead)).A.deletedAt).toBe(T2);
      expect(byId(mergeById(dead, live)).A.deletedAt).toBe(T2);   // order-independent
    });
  });

  describe('legacy records with no timestamp', () => {
    it('a record without updatedAt loses to one that has it', () => {
      const legacy: Rec[] = [{ id: 'A', amount: 1 }];
      const timestamped: Rec[] = [{ id: 'A', amount: 2, updatedAt: T1 }];
      expect(byId(mergeById(legacy, timestamped)).A.amount).toBe(2);
      expect(byId(mergeById(timestamped, legacy)).A.amount).toBe(2);
    });

    it('two legacy records without timestamps merge to one deterministically', () => {
      const local: Rec[] = [{ id: 'A', amount: 1 }];
      const remote: Rec[] = [{ id: 'A', amount: 2 }];
      const merged = mergeById(local, remote);
      expect(merged).toHaveLength(1);
      expect(merged[0].amount).toBe(1); // local (first arg) on a full tie
    });
  });

  it('handles null/empty inputs', () => {
    expect(mergeById([], [])).toEqual([]);
    expect(mergeById(null as any, [{ id: 'A' }])).toEqual([{ id: 'A' }]);
    expect(mergeById([{ id: 'A' }], null as any)).toEqual([{ id: 'A' }]);
  });
});

describe('liveRecords', () => {
  it('drops tombstones and keeps live rows', () => {
    const merged: Rec[] = [
      { id: 'A', updatedAt: T1 },
      { id: 'B', updatedAt: T2, deletedAt: T2 },
      { id: 'C', updatedAt: T1, deletedAt: null }
    ];
    expect(liveRecords(merged).map(r => r.id)).toEqual(['A', 'C']);
  });
});

describe('recordsToPush', () => {
  it('includes records remote does not have', () => {
    const merged: Rec[] = [{ id: 'A', updatedAt: T1 }];
    expect(recordsToPush(merged, []).map(r => r.id)).toEqual(['A']);
  });

  it('includes records where the merged version is newer than remote', () => {
    const merged: Rec[] = [{ id: 'A', updatedAt: T2 }];
    const remote: Rec[] = [{ id: 'A', updatedAt: T1 }];
    expect(recordsToPush(merged, remote)).toHaveLength(1);
  });

  it('includes a local tombstone remote does not know about yet', () => {
    const merged: Rec[] = [{ id: 'A', updatedAt: T2, deletedAt: T2 }];
    const remote: Rec[] = [{ id: 'A', updatedAt: T1 }];   // remote still thinks A is live
    expect(recordsToPush(merged, remote)).toHaveLength(1);
  });

  it('skips records remote already matches, so a sync is not a full re-upload', () => {
    const merged: Rec[] = [
      { id: 'A', updatedAt: T1 },
      { id: 'B', updatedAt: T2, deletedAt: T2 }
    ];
    const remote: Rec[] = [
      { id: 'A', updatedAt: T1 },
      { id: 'B', updatedAt: T2, deletedAt: T2 }
    ];
    expect(recordsToPush(merged, remote)).toEqual([]);
  });

  it('does not push a record remote has a newer version of', () => {
    // After a real merge this cannot happen (merged holds the winner), but the
    // predicate must still be safe if fed one.
    const merged: Rec[] = [{ id: 'A', updatedAt: T1 }];
    const remote: Rec[] = [{ id: 'A', updatedAt: T2 }];
    expect(recordsToPush(merged, remote)).toEqual([]);
  });
});

describe('end-to-end: merge then derive what to show and push', () => {
  it('two machines converge without losing a delete or an edit', () => {
    // Local: edited A recently, still has old live B.
    const local: Rec[] = [
      { id: 'A', amount: 999, updatedAt: T3 },
      { id: 'B', amount: 100, updatedAt: T1 }
    ];
    // Remote: has old A, and B was deleted elsewhere at T2.
    const remote: Rec[] = [
      { id: 'A', amount: 100, updatedAt: T1 },
      { id: 'B', amount: 100, updatedAt: T2, deletedAt: T2 }
    ];

    const merged = mergeById(local, remote);
    const shown = liveRecords(merged);
    const push = recordsToPush(merged, remote);

    // A's local edit survives; B's remote delete survives.
    expect(shown.map(r => r.id)).toEqual(['A']);
    expect(byId(merged).A.amount).toBe(999);
    expect(byId(merged).B.deletedAt).toBe(T2);

    // Only A needs pushing (local edit); B already matches remote's tombstone.
    expect(push.map(r => r.id)).toEqual(['A']);
  });
});
