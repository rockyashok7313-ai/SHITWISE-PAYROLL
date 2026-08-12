import { describe, it, expect } from 'vitest';
import type { StorageLike } from '../../src/lib/backup';
import {
  collectBackupPayload,
  serializeBackup,
  parseBackupFile,
  mergeBackupIntoStorage,
  shouldAutoBackup,
  getLastBackupAt,
  setLastBackupAt,
  DEFAULT_AUTO_BACKUP_INTERVAL_MS,
  clearLocalTombstones,
} from '../../src/lib/backup';

/** In-memory stand-in for window.localStorage, matching StorageLike. */
class FakeStorage implements StorageLike {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

const T1 = '2027-05-01T10:00:00.000Z';
const T2 = '2027-05-02T10:00:00.000Z';

describe('collectBackupPayload', () => {
  it('picks only backup-relevant keys and ignores everything else', () => {
    const s = new FakeStorage();
    s.setItem('companies_cache', JSON.stringify([{ id: 'C1' }]));
    s.setItem('active_company_id', 'C1');
    s.setItem('employees_C1', JSON.stringify([{ id: 'E1', name: 'A' }]));
    s.setItem('attendance_C1', JSON.stringify([{ id: 'A1' }]));
    s.setItem('vouchers_C1', JSON.stringify([{ id: 'V1' }]));
    s.setItem('theme', 'dark');                    // unrelated -- must be excluded
    s.setItem('last_auto_backup_at', T1);           // bookkeeping -- must be excluded

    const payload = collectBackupPayload(s, () => T2);

    expect(payload.schemaVersion).toBe(1);
    expect(payload.createdAt).toBe(T2);
    expect(Object.keys(payload.data).sort()).toEqual([
      'active_company_id', 'attendance_C1', 'companies_cache', 'employees_C1', 'vouchers_C1'
    ]);
    expect(payload.data.employees_C1).toEqual([{ id: 'E1', name: 'A' }]);
  });

  it('keeps a plain string value (active_company_id) as a string, not JSON-parsed garbage', () => {
    const s = new FakeStorage();
    s.setItem('active_company_id', 'co_12345');
    const payload = collectBackupPayload(s);
    expect(payload.data.active_company_id).toBe('co_12345');
  });

  it('produces an empty payload for empty storage without throwing', () => {
    const payload = collectBackupPayload(new FakeStorage());
    expect(payload.data).toEqual({});
  });
});

describe('serializeBackup / parseBackupFile', () => {
  it('round-trips a payload', () => {
    const s = new FakeStorage();
    s.setItem('employees_C1', JSON.stringify([{ id: 'E1' }]));
    const payload = collectBackupPayload(s, () => T1);
    const parsed = parseBackupFile(serializeBackup(payload));
    expect(parsed.data.employees_C1).toEqual([{ id: 'E1' }]);
    expect(parsed.createdAt).toBe(T1);
  });

  it('rejects invalid JSON with a readable error', () => {
    expect(() => parseBackupFile('not json')).toThrow(/valid JSON/);
  });

  it('rejects JSON that is not a backup file', () => {
    expect(() => parseBackupFile('{"hello":"world"}')).toThrow(/backup file/);
    expect(() => parseBackupFile('[1,2,3]')).toThrow(/backup file/);
  });
});

describe('mergeBackupIntoStorage (the actual recovery path)', () => {
  it('restores records storage is missing entirely -- the core recovery case', () => {
    const storage = new FakeStorage(); // simulates a fresh/empty browser
    const payload = { schemaVersion: 1, createdAt: T2, data: {
      employees_C1: [{ id: 'E1', name: 'Asha', updatedAt: T1 }]
    }};

    const summary = mergeBackupIntoStorage(payload, storage);

    expect(summary.restoredKeys).toContain('employees_C1');
    expect(summary.recordCounts.employees_C1).toBe(1);
    expect(JSON.parse(storage.getItem('employees_C1')!)).toEqual([{ id: 'E1', name: 'Asha', updatedAt: T1 }]);
  });

  it('does not clobber a newer local record with an older backup copy', () => {
    const storage = new FakeStorage();
    storage.setItem('employees_C1', JSON.stringify([{ id: 'E1', name: 'Asha (edited)', updatedAt: T2 }]));
    const payload = { schemaVersion: 1, createdAt: T1, data: {
      employees_C1: [{ id: 'E1', name: 'Asha (stale)', updatedAt: T1 }]
    }};

    mergeBackupIntoStorage(payload, storage);

    const result = JSON.parse(storage.getItem('employees_C1')!);
    expect(result[0].name).toBe('Asha (edited)'); // newer local wins
  });

  it('brings back a record missing locally alongside one already present', () => {
    const storage = new FakeStorage();
    storage.setItem('vouchers_C1', JSON.stringify([{ id: 'V1', updatedAt: T2 }]));
    const payload = { schemaVersion: 1, createdAt: T1, data: {
      vouchers_C1: [{ id: 'V1', updatedAt: T1 }, { id: 'V2', updatedAt: T1 }]  // V2 is missing locally
    }};

    const summary = mergeBackupIntoStorage(payload, storage);

    expect(summary.recordCounts.vouchers_C1).toBe(2);
    const ids = JSON.parse(storage.getItem('vouchers_C1')!).map((v: any) => v.id).sort();
    expect(ids).toEqual(['V1', 'V2']);
  });

  it('lets a tombstone in the backup propagate a delete when it is newer', () => {
    const storage = new FakeStorage();
    storage.setItem('vouchers_C1', JSON.stringify([{ id: 'V1', updatedAt: T1 }])); // live locally
    const payload = { schemaVersion: 1, createdAt: T2, data: {
      vouchers_C1: [{ id: 'V1', updatedAt: T2, deletedAt: T2 }]  // deleted elsewhere, newer
    }};

    mergeBackupIntoStorage(payload, storage);

    const result = JSON.parse(storage.getItem('vouchers_C1')!);
    expect(result[0].deletedAt).toBe(T2);
  });

  it('unions companies_cache by id, current entries winning on conflict', () => {
    const storage = new FakeStorage();
    storage.setItem('companies_cache', JSON.stringify([{ id: 'C1', name: 'Current Name' }]));
    const payload = { schemaVersion: 1, createdAt: T1, data: {
      companies_cache: [{ id: 'C1', name: 'Old Name' }, { id: 'C2', name: 'Second Co' }]
    }};

    mergeBackupIntoStorage(payload, storage);

    const result = JSON.parse(storage.getItem('companies_cache')!);
    const byId = Object.fromEntries(result.map((c: any) => [c.id, c.name]));
    expect(byId.C1).toBe('Current Name'); // current wins
    expect(byId.C2).toBe('Second Co');    // missing one restored
  });

  it('only sets active_company_id from the backup if storage has none', () => {
    const withExisting = new FakeStorage();
    withExisting.setItem('active_company_id', 'C_CURRENT');
    mergeBackupIntoStorage({ schemaVersion: 1, createdAt: T1, data: { active_company_id: 'C_BACKUP' } }, withExisting);
    expect(withExisting.getItem('active_company_id')).toBe('C_CURRENT'); // untouched

    const empty = new FakeStorage();
    mergeBackupIntoStorage({ schemaVersion: 1, createdAt: T1, data: { active_company_id: 'C_BACKUP' } }, empty);
    expect(empty.getItem('active_company_id')).toBe('C_BACKUP'); // filled in
  });

  it('ignores keys in the payload that are not recognised backup keys', () => {
    const storage = new FakeStorage();
    const summary = mergeBackupIntoStorage(
      { schemaVersion: 1, createdAt: T1, data: { some_random_key: 'x', theme: 'dark' } },
      storage
    );
    expect(summary.restoredKeys).toEqual([]);
    expect(storage.getItem('some_random_key')).toBeNull();
  });

  it('handles an empty payload without throwing', () => {
    const storage = new FakeStorage();
    const summary = mergeBackupIntoStorage({ schemaVersion: 1, createdAt: T1, data: {} }, storage);
    expect(summary.restoredKeys).toEqual([]);
  });
});

describe('shouldAutoBackup (the throttle)', () => {
  it('is true when a backup has never run', () => {
    expect(shouldAutoBackup(new FakeStorage(), DEFAULT_AUTO_BACKUP_INTERVAL_MS)).toBe(true);
  });

  it('is false immediately after a backup, within the interval', () => {
    const s = new FakeStorage();
    setLastBackupAt(s, T1);
    const justAfter = () => Date.parse(T1) + 1000; // 1s later
    expect(shouldAutoBackup(s, DEFAULT_AUTO_BACKUP_INTERVAL_MS, justAfter)).toBe(false);
  });

  it('is true once the interval has elapsed', () => {
    const s = new FakeStorage();
    setLastBackupAt(s, T1);
    const wellAfter = () => Date.parse(T1) + DEFAULT_AUTO_BACKUP_INTERVAL_MS + 1;
    expect(shouldAutoBackup(s, DEFAULT_AUTO_BACKUP_INTERVAL_MS, wellAfter)).toBe(true);
  });

  it('is true if the stored timestamp is corrupt', () => {
    const s = new FakeStorage();
    setLastBackupAt(s, 'not-a-date');
    expect(shouldAutoBackup(s, DEFAULT_AUTO_BACKUP_INTERVAL_MS)).toBe(true);
  });

  it('getLastBackupAt/setLastBackupAt round-trip', () => {
    const s = new FakeStorage();
    expect(getLastBackupAt(s)).toBeNull();
    setLastBackupAt(s, T1);
    expect(getLastBackupAt(s)).toBe(T1);
  });
});

describe('clearLocalTombstones (the "staff still missing" repair)', () => {
  const NOW = '2027-06-01T00:00:00.000Z';

  it('revives tombstoned employees and stamps them newer so they win the merge', () => {
    const s = new FakeStorage();
    s.setItem('employees_C1', JSON.stringify([
      { id: 'E1', name: 'Asha', updatedAt: T1, deletedAt: T2 },
      { id: 'E2', name: 'Ravi', updatedAt: T1, deletedAt: null },
    ]));

    const res = clearLocalTombstones(s, NOW);

    expect(res.cleared).toBe(1);
    const out = JSON.parse(s.getItem('employees_C1')!);
    const revived = out.find((e: any) => e.id === 'E1');
    expect(revived.deletedAt).toBeNull();
    expect(revived.updatedAt).toBe(NOW); // newer, so the merge keeps it alive
  });

  it('leaves already-live records completely untouched', () => {
    const s = new FakeStorage();
    const original = [{ id: 'E2', name: 'Ravi', updatedAt: T1, deletedAt: null }];
    s.setItem('employees_C1', JSON.stringify(original));

    const res = clearLocalTombstones(s, NOW);

    expect(res.cleared).toBe(0);
    expect(JSON.parse(s.getItem('employees_C1')!)).toEqual(original);
  });

  it('repairs attendance as well as employees', () => {
    const s = new FakeStorage();
    s.setItem('attendance_C1', JSON.stringify([{ id: 'A1', updatedAt: T1, deletedAt: T2 }]));
    expect(clearLocalTombstones(s, NOW).cleared).toBe(1);
  });

  it('NEVER touches vouchers -- those deletions are deliberate and audited', () => {
    const s = new FakeStorage();
    const vouchers = [{ id: 'V1', updatedAt: T1, deletedAt: T2 }];
    s.setItem('vouchers_C1', JSON.stringify(vouchers));

    const res = clearLocalTombstones(s, NOW);

    expect(res.cleared).toBe(0);
    expect(JSON.parse(s.getItem('vouchers_C1')!)).toEqual(vouchers); // untouched
  });

  it('can only revive -- it never removes a record', () => {
    const s = new FakeStorage();
    s.setItem('employees_C1', JSON.stringify([
      { id: 'E1', deletedAt: T2 }, { id: 'E2' }, { id: 'E3', deletedAt: T2 },
    ]));
    clearLocalTombstones(s, NOW);
    expect(JSON.parse(s.getItem('employees_C1')!)).toHaveLength(3);
  });

  it('is a no-op on empty storage', () => {
    expect(clearLocalTombstones(new FakeStorage(), NOW)).toMatchObject({ cleared: 0 });
  });
});
