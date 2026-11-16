import { useMemo } from 'react';
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

  const isDefaultExcluded = (v: string) => DEFAULT_SETTINGS.excludedPeople.includes(v);
  const add = (k: 'excludedPeople' | 'extraBars', v: string) => {
    if (!settings[k].includes(v)) setSettings({ ...settings, [k]: [...settings[k], v] });
  };
  const remove = (k: 'excludedPeople' | 'extraBars', v: string) => setSettings({ ...settings, [k]: settings[k].filter((x) => x !== v) });

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <div className="max-w-3xl space-y-8">
      <PageTitle title="Settings" subtitle="Saved on this device only. Changes re-run the analysis immediately." />

      <Section
        title="Excluded people"
        subtitle={
          <>
            Money to these people is still counted in totals and shown in the People tab, but they are left out of red flags and the drains
            list. People marked “default” come from src/profile.ts.
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
          badge={(v) => (isDefaultExcluded(v) ? 'default' : null)}
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

      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setSettings(DEFAULT_SETTINGS)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
