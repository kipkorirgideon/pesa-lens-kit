import type { ParseResult } from './types';
import { BackupError, validateBackup } from './validate';
export { BackupError };
import { parseBackup } from './parse';

function friendly(err: unknown): Error {
  if (err instanceof BackupError) return err;
  if (err instanceof SyntaxError)
    return new BackupError('This file could not be read as JSON. Choose the .sms / .json file exported by the SMS Backup app.');
  return new BackupError('Something went wrong while reading the file: ' + (err instanceof Error ? err.message : String(err)));
}

function parseOnMainThread(text: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    // Yield a frame so the spinner can paint before the heavy work.
    setTimeout(() => {
      try {
        resolve(parseBackup(validateBackup(JSON.parse(text))));
      } catch (e) {
        reject(friendly(e));
      }
    }, 30);
  });
}

/** Read + parse a backup file, in a Web Worker when available, else on the main thread. */
export async function loadBackupFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  if (!/^\s*[{[]/.test(text.slice(0, 200))) {
    throw new BackupError('This does not look like an SMS Backup file. Choose the .sms / .json file exported by the SMS Backup app.');
  }
  if (typeof Worker === 'undefined') return parseOnMainThread(text);
  let worker: Worker;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return parseOnMainThread(text);
  }
  return new Promise<ParseResult>((resolve, reject) => {
    let settled = false;
    const done = () => {
      settled = true;
      worker.terminate();
    };
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: ParseResult; error?: string }>) => {
      done();
      if (e.data.ok && e.data.result) resolve(e.data.result);
      else {
        const msg = e.data.error ?? 'Unknown error';
        reject(
          /Unexpected token|JSON/i.test(msg) && !/listSms/.test(msg)
            ? new BackupError('This file could not be read as JSON. Choose the .sms / .json file exported by the SMS Backup app.')
            : new BackupError(msg),
        );
      }
    };
    worker.onerror = (ev) => {
      ev.preventDefault();
      if (settled) return;
      done();
      // Worker failed to start (e.g. file:// or old browser) — fall back to the main thread.
      parseOnMainThread(text).then(resolve, reject);
    };
    worker.postMessage(text);
  });
}
