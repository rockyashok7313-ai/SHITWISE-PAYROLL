/**
 * Local backup and restore for the data this app caches in localStorage
 * (companies, employees, attendance, vouchers).
 *
 * WHY THIS EXISTS: the previous auto-backup lived inside AppProvider's
 * loadData, AFTER the Supabase session check. If auth failed for any reason
 * -- including the exact incident that prompted this file, a paused Supabase
 * project -- loadData returned before the backup code was ever reached. The
 * one moment a backup matters most was the one moment it could not run.
 *
 * This module has no dependency on a live session or a reachable Supabase
 * project. It reads and writes only the browser's own localStorage, so it
 * works during an outage, and its restore step is reachable from the login
 * page itself (see /login's recovery panel) -- you should not need to be
 * logged in to get your own cached data back.
 *
 * Pure functions take a StorageLike so they can be tested without a real
 * browser; the thin download/file-read wrappers are the only browser-only
 * parts.
 */

import { mergeById, type Syncable } from "./sync";

export const BACKUP_SCHEMA_VERSION = 1;

/** Matches window.localStorage's read/enumerate surface. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Per-company arrays that go through the sync merge model. */
const SYNCED_ARRAY_PREFIXES = ["employees_", "attendance_", "vouchers_"];

function isBackedUpKey(key: string): boolean {
  return key === "companies_cache" || key === "active_company_id" ||
    SYNCED_ARRAY_PREFIXES.some(p => key.startsWith(p));
}

export interface BackupPayload {
  schemaVersion: number;
  createdAt: string;
  /** Raw localStorage values, already JSON.parse'd where possible. */
  data: Record<string, unknown>;
}

/** Reads every backed-up key out of storage into one payload. Never throws. */
export function collectBackupPayload(storage: StorageLike, now: () => string = () => new Date().toISOString()): BackupPayload {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !isBackedUpKey(key)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw; // active_company_id is a plain string, not JSON
    }
  }
  return { schemaVersion: BACKUP_SCHEMA_VERSION, createdAt: now(), data };
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** Parses and shape-validates a backup file's text. Throws a readable error on failure. */
export function parseBackupFile(text: string): BackupPayload {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.data !== "object" || parsed.data === null) {
    throw new Error("This does not look like a ShiftWise backup file (missing a 'data' object).");
  }
  return {
    schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 0,
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "unknown",
    data: parsed.data,
  };
}

export interface RestoreSummary {
  /** Backed-up keys the payload actually contained and were applied. */
  restoredKeys: string[];
  /** For each synced array key, how many records ended up live after merging. */
  recordCounts: Record<string, number>;
}

/**
 * Merges a backup payload into storage. This is a MERGE, not an overwrite:
 * for the per-company synced arrays (employees/attendance/vouchers) it runs
 * the same mergeById used for cloud sync, so a record already present with a
 * newer updatedAt is kept, and a record the current storage is missing (the
 * actual recovery case) is added back. A tombstone in the backup can still
 * propagate a delete if it is newer -- consistent with how sync already
 * behaves everywhere else in this app.
 *
 * companies_cache is unioned by id, current entries winning on conflict
 * (company metadata changes rarely and current local state is more likely
 * fresh). active_company_id is only set from the backup if storage does not
 * already have one, so restoring never silently switches which company is
 * active.
 *
 * Only writes to storage; does not talk to Supabase. The next successful
 * login runs the app's normal load/sync path, which will push whatever this
 * merge added up to the cloud once it is reachable again.
 */
export function mergeBackupIntoStorage(payload: BackupPayload, storage: StorageLike): RestoreSummary {
  const restoredKeys: string[] = [];
  const recordCounts: Record<string, number> = {};

  for (const [key, value] of Object.entries(payload.data)) {
    if (!isBackedUpKey(key)) continue;

    if (key === "active_company_id") {
      if (typeof value === "string" && !storage.getItem("active_company_id")) {
        storage.setItem("active_company_id", value);
        restoredKeys.push(key);
      }
      continue;
    }

    if (key === "companies_cache") {
      const current: any[] = safeArray(storage.getItem("companies_cache"));
      const incoming: any[] = Array.isArray(value) ? value : [];
      const byId = new Map<string, any>(incoming.map(c => [c.id, c]));
      for (const c of current) byId.set(c.id, c); // current wins on conflict
      const merged = [...byId.values()];
      storage.setItem("companies_cache", JSON.stringify(merged));
      restoredKeys.push(key);
      recordCounts[key] = merged.length;
      continue;
    }

    if (SYNCED_ARRAY_PREFIXES.some(p => key.startsWith(p))) {
      const current: Syncable[] = safeArray(storage.getItem(key));
      const incoming: Syncable[] = Array.isArray(value) ? (value as Syncable[]) : [];
      if (incoming.length === 0) continue;
      const merged = mergeById(current, incoming);
      storage.setItem(key, JSON.stringify(merged));
      restoredKeys.push(key);
      recordCounts[key] = merged.length;
    }
  }

  return { restoredKeys, recordCounts };
}

function safeArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface TombstoneRepairResult {
  /** How many records had a deletion marker removed. */
  cleared: number;
  /** Per storage key, how many were revived. */
  perKey: Record<string, number>;
}

/**
 * Removes deletion markers from the locally cached records.
 *
 * WHY THIS EXISTS: sync resolves each record by newest `updatedAt`, and a
 * tombstone wins over an older live copy. If a browser holds tombstones from
 * a bad delete (see the Staff Management stale-save bug), those tombstones
 * are newer than the records restored to the cloud -- so the merge keeps
 * hiding staff that genuinely exist server-side, and the screen stays empty
 * no matter how many times the cloud is fixed.
 *
 * This clears them locally and stamps `updatedAt` to now, so the revived
 * records win the next merge instead of being re-hidden.
 *
 * Only ever REVIVES records -- it cannot delete anything. Vouchers are
 * deliberately excluded: voucher deletions are real user actions recorded in
 * the audit trail, and blanket-reviving them would resurrect payments that
 * were removed on purpose.
 */
export function clearLocalTombstones(
  storage: StorageLike,
  now: string = new Date().toISOString()
): TombstoneRepairResult {
  const perKey: Record<string, number> = {};
  let cleared = 0;

  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && (k.startsWith('employees_') || k.startsWith('attendance_'))) keys.push(k);
  }

  for (const key of keys) {
    const list = safeArray(storage.getItem(key));
    if (!list.length) continue;

    let count = 0;
    const revived = list.map((r: any) => {
      if (!r || !r.deletedAt) return r;
      count++;
      return { ...r, deletedAt: null, updatedAt: now };
    });

    if (count > 0) {
      storage.setItem(key, JSON.stringify(revived));
      perKey[key] = count;
      cleared += count;
    }
  }

  return { cleared, perKey };
}

/* ------------------------------------------------------------------ */
/* Throttle: how often an automatic backup is allowed to fire.         */
/* ------------------------------------------------------------------ */

const LAST_BACKUP_KEY = "last_auto_backup_at";

export function getLastBackupAt(storage: StorageLike): string | null {
  return storage.getItem(LAST_BACKUP_KEY);
}

export function setLastBackupAt(storage: StorageLike, iso: string): void {
  storage.setItem(LAST_BACKUP_KEY, iso);
}

/**
 * Whether enough time has passed to allow another automatic backup.
 * True if one has never run. Used both on app load and after a mutation, so
 * backups happen far more often than the old once-a-calendar-day check, but
 * without downloading a file on every keystroke.
 */
export function shouldAutoBackup(storage: StorageLike, minIntervalMs: number, now: () => number = Date.now): boolean {
  const last = getLastBackupAt(storage);
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (isNaN(lastMs)) return true;
  return now() - lastMs >= minIntervalMs;
}

/** Default minimum gap between automatic backups: 1 hour. */
export const DEFAULT_AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Browser-only helpers (download / file read). Not unit tested --     */
/* there is nothing left to test once the DOM APIs are mocked out; the */
/* logic above is what actually decides correctness.                   */
/* ------------------------------------------------------------------ */

function backupFilename(createdAt: string): string {
  const safe = createdAt.replace(/[:.]/g, "-");
  return `shiftwise_backup_${safe}.json`;
}

/** Collects the current localStorage into a file and triggers a browser download. */
export function downloadBackupNow(storage: StorageLike = window.localStorage): { filename: string; payload: BackupPayload } {
  const payload = collectBackupPayload(storage);
  const json = serializeBackup(payload);
  const filename = backupFilename(payload.createdAt);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setLastBackupAt(storage, payload.createdAt);
  return { filename, payload };
}

/** Reads an uploaded File as text (for the restore file picker). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsText(file);
  });
}
