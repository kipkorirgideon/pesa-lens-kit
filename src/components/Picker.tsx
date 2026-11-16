import { useId, useMemo, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
  hint?: string;
}

/** Chips for the selected values + a searchable list to add more. */
export function Picker({
  selected,
  options,
  onAdd,
  onRemove,
  placeholder,
  labelFor,
  badge,
}: {
  selected: string[];
  options: Option[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  labelFor: (v: string) => string;
  badge?: (v: string) => string | null;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const chosen = useMemo(() => new Set(selected), [selected]);
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return options
      .filter((o) => !chosen.has(o.value) && (o.label.toLowerCase().includes(n) || o.hint?.toLowerCase().includes(n)))
      .slice(0, 10);
  }, [q, options, chosen]);

  return (
    <div className="space-y-3">
      {selected.length === 0 ? (
        <p className="text-sm text-gray-500">None yet.</p>
      ) : (
        <ul aria-label="Selected" className="flex flex-wrap gap-2">
          {selected.map((v) => (
            <li key={v} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-300 py-1 pl-3 pr-1 text-sm">
              <span className="truncate">{labelFor(v)}</span>
              {badge?.(v) && <span className="shrink-0 text-xs text-gray-500">{badge(v)}</span>}
              <button
                type="button"
                onClick={() => onRemove(v)}
                aria-label={`Remove ${labelFor(v)}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative max-w-md">
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder.replace(/…$/, '')}
          aria-controls={listId}
          className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
        />
        <div role="status" className="sr-only">
          {q.trim()
            ? matches.length === 0
              ? 'No matches.'
              : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} available.`
            : ''}
        </div>
        {q.trim() && (
          <ul
            id={listId}
            aria-label="Matches"
            className="relative mt-1 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-sm"
          >
            {matches.length === 0 && <li className="px-3 py-2 text-gray-500">No matches.</li>}
            {matches.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(o.value);
                    setQ('');
                    inputRef.current?.focus();
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-gray-500 tabular-nums">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
