import { useMemo, useState } from 'react';
import { useApp, useAnalysis } from '../state';
import { DEFAULT_SETTINGS } from '../lib/types';
import { ksh, normName, titleCase } from '../lib/format';
import { PageTitle, Section } from '../components/ui';
import { Picker } from '../components/Picker';

export default function SettingsPage() {
  const a = useAnalysis();
  const { settings, setSettings } = useApp();

  const peopleOpts = useMemo(
    () =>
      [...a.people]
        .sort((x, y) => y.sent + y.recv - (x.sent + x.recv))
        .map((p) => ({ value: normName(p.name), label: titleCase(p.name), hint: `sent ${ksh(p.sent)}` })),
    [a.people],
  );

  const payeeOpts = useMemo(() => {
    const m = new Map<string, { amount: number; types: Set<string> }>();
    a.payees.forEach((p) => {
      const e = m.get(p.name) ?? { amount: 0, types: new Set<string>() };
      e.amount += p.amount;
      e.types.add(p.type === 'Paybill' ? 'paybill' : 'till');
      m.set(p.name, e);
    });
    return [...m.entries()]
      .sort((x, y) => y[1].amount - x[1].amount)
      .map(([name, e]) => ({ value: name, label: name, hint: `${[...e.types].join(' / ')} · ${ksh(e.amount)}` }));
  }, [a.payees]);

  const add = (k: 'excludedPeople' | 'extraBars' | 'extraFood', v: string) => {
    if (!settings[k].includes(v)) setSettings({ ...settings, [k]: [...settings[k], v] });
  };
  const remove = (k: 'excludedPeople' | 'extraBars' | 'extraFood', v: string) =>
    setSettings({ ...settings, [k]: settings[k].filter((x) => x !== v) });

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <div className="max-w-3xl space-y-8">
      <PageTitle title="Settings" subtitle="Saved on this device only. Changes re-run the analysis immediately." />

      <Section
        title="Excluded people"
        subtitle={
          <>
            Money to these people is still counted in totals and shown in the People tab, but they are left out of red flags and the drains
            list.
          </>
        }
      >
        <Picker
          selected={settings.excludedPeople}
          options={peopleOpts}
          onAdd={(v) => add('excludedPeople', v)}
          onRemove={(v) => remove('excludedPeople', v)}
          placeholder="Search people to exclude…"
          labelFor={titleCase}
        />
      </Section>

      <Section
        title="Extra bars"
        subtitle="Tag tills or paybills that are really bars or lounges but weren’t recognised by name. They’ll count as bars in Bars & restaurants and the drains list."
      >
        <Picker
          selected={settings.extraBars}
          options={payeeOpts}
          onAdd={(v) => add('extraBars', v)}
          onRemove={(v) => remove('extraBars', v)}
          placeholder="Search tills and paybills…"
          labelFor={(v) => v}
        />
      </Section>

      <Section
        title="Extra food venues"
        subtitle="Tills or paybills that are really restaurants or food places but weren’t recognised by name. Pick one, or type text: anything starting with it (any capitalisation) counts as food. Plain text only, no patterns."
      >
        <Picker
          selected={settings.extraFood}
          options={payeeOpts}
          onAdd={(v) => add('extraFood', v)}
          onRemove={(v) => remove('extraFood', v)}
          placeholder="Search or type a venue name…"
          labelFor={(v) => v}
          allowCustom
        />
      </Section>

      <Section
        title="Venue merges"
        subtitle="Combine several tills of one venue into a single name in Bars & restaurants. Any payee whose name starts with the text (any capitalisation) is shown under the merged name. The first matching rule wins."
      >
        <MergeEditor merges={settings.venueMerges} onChange={(venueMerges) => setSettings({ ...settings, venueMerges })} />
      </Section>

      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setSettings(DEFAULT_SETTINGS)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-gray-500 focus-visible:ring-2 focus-visible:ring-blue-600';

function MergeEditor({
  merges,
  onChange,
}: {
  merges: { match: string; name: string }[];
  onChange: (m: { match: string; name: string }[]) => void;
}) {
  const [match, setMatch] = useState('');
  const [name, setName] = useState('');
  const can = match.trim() !== '' && name.trim() !== '';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!can) return;
    onChange([...merges, { match: match.trim(), name: name.trim() }]);
    setMatch('');
    setName('');
  };
  return (
    <div className="space-y-3">
      {merges.length === 0 ? (
        <p className="text-sm text-gray-500">None yet.</p>
      ) : (
        <ul className="space-y-2">
          {merges.map((m, i) => (
            <li
              key={`${m.match}|${m.name}|${i}`}
              className="flex items-center gap-2 rounded-md border border-gray-300 py-1 pl-3 pr-1 text-sm"
            >
              <span className="min-w-0 flex-1 break-words">
                Starts with <strong>{m.match}</strong> → <strong>{m.name}</strong>
              </span>
              <button
                type="button"
                onClick={() => onChange(merges.filter((_, j) => j !== i))}
                aria-label={`Remove merge ${m.match} to ${m.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-gray-600">
          Name starts with
          <input className={inputCls + ' mt-1'} value={match} onChange={(e) => setMatch(e.target.value)} />
        </label>
        <label className="flex-1 text-xs text-gray-600">
          Show as
          <input className={inputCls + ' mt-1'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={!can}
          className="h-9 rounded-md border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add merge
        </button>
      </form>
    </div>
  );
}
