/// <reference lib="webworker" />
// Parses an SMS backup off the main thread. Receives the file text, posts back a ParseResult.
import { parseBackup } from './parse';
import { validateBackup } from './validate';

self.onmessage = (e: MessageEvent<string>) => {
  try {
    const raw = validateBackup(JSON.parse(e.data));
    const result = parseBackup(raw);
    (self as unknown as Worker).postMessage({ ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
