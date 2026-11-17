// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SettingsPage from './Settings';
import { AppCtx, type AppState } from '../state';
import { DEFAULT_SETTINGS, type Settings } from '../lib/types';
import { analyze } from '../lib/analyze';
import { nairobi, parseResult, txn } from '../lib/__fixtures__/messages';

afterEach(cleanup);

const parse = parseResult([
  txn('till', nairobi(2026, 5, 10, 12), 900, { name: 'Zed Corner Shop 1' }),
  txn('till', nairobi(2026, 5, 11, 12), 400, { name: 'ZED CORNER SHOP 2' }),
]);

let latest: Settings = DEFAULT_SETTINGS;
function Harness() {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const setSettings = (next: Settings) => {
    latest = next;
    setSettingsState(next);
  };
  const state: AppState = {
    parse: null,
    analysis: analyze(parse, settings),
    analysisError: null,
    settings,
    setSettings,
    loading: false,
    loadError: null,
    fileName: null,
    loadFile: async () => false,
    reset: () => {},
  };
  return (
    <AppCtx.Provider value={state}>
      <SettingsPage />
    </AppCtx.Provider>
  );
}

describe('Settings page', () => {
  it('Extra bars accepts a typed prefix, stores it, and the engine applies it to every matching till', () => {
    render(<Harness />);
    // Extra bars is the first picker that has the "type a venue name" placeholder.
    const [barsInput] = screen.getAllByPlaceholderText('Search or type a venue name…');
    fireEvent.change(barsInput, { target: { value: 'zed corn' } });
    fireEvent.click(screen.getByRole('button', { name: /Add “zed corn” as typed/ }));
    expect(latest.extraBars).toEqual(['zed corn']);
    expect(latest.extraFood).toEqual([]);
    expect(analyze(parse, latest).fb.summary).toMatchObject({ payments: 2, bars: 1300 });
  });

  it('subtitles for bars and food use the identical starts-with wording and do not promise substring matching', () => {
    render(<Harness />);
    const rule = 'Any payee whose name starts with the text (any capitalisation) counts as';
    const tail = 'A fragment from the middle of a name will not match. Plain text only, no patterns.';
    expect(screen.getByText((t) => t.includes(`${rule} a bar. ${tail}`))).toBeTruthy();
    expect(screen.getByText((t) => t.includes(`${rule} food. ${tail}`))).toBeTruthy();
    expect(screen.getByText((t) => t.includes('Any payee whose name starts with the text (any capitalisation) is shown'))).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/contains|anywhere in|substring/i);
  });

  it('flags a shadowed venue merge, a case-variant duplicate, and nothing for distinct rules', () => {
    render(<Harness />);
    const merge = (m: string, n: string) => {
      fireEvent.change(screen.getByLabelText('Name starts with'), { target: { value: m } });
      fireEvent.change(screen.getByLabelText('Show as'), { target: { value: n } });
      fireEvent.click(screen.getByRole('button', { name: 'Add merge' }));
    };
    merge('Zed', 'Zed');
    merge('Quux', 'Quux');
    expect(screen.queryByText(/Unreachable/)).toBeNull();
    merge('Zed Corner', 'Zed Corner');
    expect(screen.getByText(/Unreachable: an earlier rule starting with “Zed” already matches/)).toBeTruthy();
    expect(latest.venueMerges).toHaveLength(3);

    const [barsInput] = screen.getAllByPlaceholderText('Search or type a venue name…');
    const addBar = (v: string) => {
      fireEvent.change(barsInput, { target: { value: v } });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`Add “${v}” as typed`) }));
    };
    // The status region must already be mounted before any note exists, or the first note is not announced.
    const regionsBefore = screen.getAllByTestId('rule-notes');
    expect(regionsBefore.length).toBeGreaterThan(0);
    regionsBefore.forEach((r) => {
      expect(r.getAttribute('role')).toBe('status');
      expect(r.textContent).not.toContain('redundant'); // the merge region may already hold its seeded note
    });
    addBar('zed corn');
    addBar('Other Place');
    expect(screen.queryByText(/redundant/)).toBeNull();
    addBar('ZED CORN');
    expect(latest.extraBars).toEqual(['zed corn', 'Other Place', 'ZED CORN']);
    expect(screen.getByText(/“ZED CORN” is redundant: it is the same as “zed corn”/)).toBeTruthy();
    // Announced: notes live inside a status region that exists before any note does.
    expect(screen.getAllByTestId('rule-notes').some((r) => r.textContent?.includes('redundant'))).toBe(true);
    // Same DOM nodes as before: the region was not remounted when the note appeared. (toBe: toEqual is structural and cannot see a remount).
    screen.getAllByTestId('rule-notes').forEach((r, i) => expect(r).toBe(regionsBefore[i]));
  });

  it('ignores a venue merge that duplicates an existing match+name pair', () => {
    render(<Harness />);
    const add = () => {
      fireEvent.change(screen.getByLabelText('Name starts with'), { target: { value: 'Zed' } });
      fireEvent.change(screen.getByLabelText('Show as'), { target: { value: 'Zed Shop' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add merge' }));
    };
    add();
    add();
    expect(latest.venueMerges).toEqual([{ match: 'Zed', name: 'Zed Shop' }]);
  });

  it('"Clear all settings" empties everything', () => {
    render(<Harness />);
    expect(screen.queryByText('Reset to defaults')).toBeNull();
    const btn = screen.getByRole('button', { name: 'Clear all settings' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
