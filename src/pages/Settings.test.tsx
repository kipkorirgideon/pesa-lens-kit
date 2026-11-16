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

  it('subtitles for bars and food both state the starts-with rule and do not promise substring matching', () => {
    render(<Harness />);
    const rule = 'anything starting with it (any capitalisation) counts as';
    expect(screen.getByText((t) => t.includes(`${rule} a bar. Plain text only, no patterns`))).toBeTruthy();
    expect(screen.getByText((t) => t.includes(`${rule} food. Plain text only, no patterns`))).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/contains|anywhere in|substring/i);
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
