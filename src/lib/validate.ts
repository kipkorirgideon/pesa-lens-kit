import type { RawSms } from './types';

export class BackupError extends Error {}

/** Throws a friendly BackupError when the parsed JSON is not an SMS Backup export. */
export function validateBackup(data: unknown): { listSms: RawSms[] } {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { listSms?: unknown }).listSms)) {
    throw new BackupError('This file is JSON, but not an SMS Backup export (no "listSms" list found).');
  }
  const list = (data as { listSms: unknown[] }).listSms;
  if (list.length && (typeof list[0] !== 'object' || list[0] == null || typeof (list[0] as RawSms).body !== 'string')) {
    throw new BackupError('The "listSms" entries do not look like SMS messages.');
  }
  return data as { listSms: RawSms[] };
}
