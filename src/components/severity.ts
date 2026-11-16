// Severity colour classes (colour is never the only signal: SeverityLabel also prints the word).
import type { Flag } from '../lib/types';

export const SEVERITY_TEXT: Record<Flag['severity'], string> = {
  High: 'text-red-600',
  Medium: 'text-amber-700',
  Low: 'text-gray-500',
};
