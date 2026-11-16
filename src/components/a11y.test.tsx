// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataTable, type Column } from './DataTable';
import { Picker } from './Picker';
import { ChartCard, Cue, Legend, Segmented, SeverityLabel } from './ui';
import { patternDefs, patternFill, patternId } from './patterns';
import { chartData } from './chartUtils';
import Upload from '../pages/Upload';
import { AppCtx, type AppState } from '../state';
import { COLORS } from '../lib/format';
import { DEFAULT_SETTINGS } from '../lib/types';
import { analyze } from '../lib/analyze';
import { nairobi, parseResult, txn } from '../lib/__fixtures__/messages';
import Overview from '../pages/Overview';
import Loans from '../pages/Loans';
import Payees from '../pages/Payees';
import People from '../pages/People';
import Bars from '../pages/Bars';
import Flags from '../pages/Flags';

afterEach(cleanup);

interface Row {
  name: string;
  amount: number;
}
const rows: Row[] = [
  { name: 'Alpha Shop', amount: 300 },
  { name: 'Beta Bar', amount: 100 },
  { name: 'Gamma Cafe', amount: 200 },
];
const cols: Column<Row>[] = [
  { key: 'name', header: 'Name', value: (r) => r.name },
  { key: 'amount', header: 'Amount', value: (r) => r.amount, align: 'right' },
  { key: 'note', header: 'Note', value: () => 'x', sortable: false },
];

describe('DataTable', () => {
  const table = () => (
    <DataTable rows={rows} columns={cols} rowKey={(r) => r.name} filename="mpesa-test-rows" searchable searchPlaceholder="Search shops…" />
  );

  it('toggles aria-sort on the sorted header only', () => {
    render(table());
    const nameTh = screen.getByRole('columnheader', { name: /Name/ });
    const amountTh = screen.getByRole('columnheader', { name: /Amount/ });
    expect(nameTh.getAttribute('aria-sort')).toBe('none');
    expect(screen.getByRole('columnheader', { name: 'Note' }).hasAttribute('aria-sort')).toBe(false);

    fireEvent.click(within(nameTh).getByRole('button'));
    expect(nameTh.getAttribute('aria-sort')).toBe('ascending');
    expect(amountTh.getAttribute('aria-sort')).toBe('none');

    fireEvent.click(within(nameTh).getByRole('button'));
    expect(nameTh.getAttribute('aria-sort')).toBe('descending');
  });

  it('sorts numeric columns descending first and reorders rows', () => {
    render(table());
    fireEvent.click(screen.getByRole('button', { name: /Amount/ }));
    const body = screen.getAllByRole('row').slice(1);
    expect(within(body[0]).getByText('Alpha Shop')).toBeTruthy();
  });

  it('has a labelled search input, a named table and a focusable scroll region', () => {
    render(table());
    const search = screen.getByRole('searchbox', { name: 'Search shops' });
    fireEvent.change(search, { target: { value: 'beta' } });
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('1 of 3');
    expect(screen.getByRole('table', { name: 'test rows' })).toBeTruthy();
    const region = screen.getByRole('region', { name: 'test rows (scrollable)' });
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('offers CSV export as a real button', () => {
    render(table());
    expect(screen.getByRole('button', { name: 'Download CSV' }).tagName).toBe('BUTTON');
  });
});

describe('Picker', () => {
  it('is labelled, operable via buttons, and returns focus to the input after adding', () => {
    const onAdd = vi.fn();
    render(
      <Picker
        selected={['a']}
        options={[{ value: 'b', label: 'Bravo', hint: 'hint' }]}
        onAdd={onAdd}
        onRemove={() => {}}
        placeholder="Search people…"
        labelFor={(v) => v.toUpperCase()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Remove A' })).toBeTruthy();
    const input = screen.getByRole('searchbox', { name: 'Search people' });
    fireEvent.change(input, { target: { value: 'brav' } });
    expect(screen.getByRole('status').textContent).toBe('1 match available.');
    fireEvent.click(screen.getByRole('button', { name: /Bravo/ }));
    expect(onAdd).toHaveBeenCalledWith('b');
    expect(document.activeElement).toBe(input);
  });
});

describe('Segmented (radiogroup)', () => {
  const opts = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
  ];
  /** Controlled wrapper so selection actually moves, as it does in the pages. */
  function Harness({ onChange = () => {}, initial = 'a' }: { onChange?: (v: string) => void; initial?: string }) {
    const [v, setV] = useState(initial);
    return (
      <Segmented
        label="Rank by"
        value={v}
        options={opts}
        onChange={(x) => {
          setV(x);
          onChange(x);
        }}
      />
    );
  }
  const radio = (name: string) => screen.getByRole('radio', { name });
  const checkedLabel = () => screen.getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')?.textContent;

  it('is a labelled radiogroup of radios with aria-checked, not aria-pressed toggles', () => {
    render(<Harness />);
    const group = screen.getByRole('radiogroup', { name: 'Rank by' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
    expect(radio('A').getAttribute('aria-checked')).toBe('true');
    expect(radio('B').getAttribute('aria-checked')).toBe('false');
    expect(group.querySelector('[aria-pressed]')).toBeNull();
  });

  it('uses a roving tabindex: only the checked radio is a tab stop', () => {
    render(<Harness initial="b" />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('selects on click and moves the tab stop with it', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(radio('C'));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(radio('C').getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '-1', '0']);
  });

  it('ArrowRight and ArrowDown select the next radio and move focus to it', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    radio('A').focus();
    fireEvent.keyDown(radio('A'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(checkedLabel()).toBe('B');
    expect(document.activeElement).toBe(radio('B'));
    fireEvent.keyDown(radio('B'), { key: 'ArrowDown' });
    expect(checkedLabel()).toBe('C');
    expect(document.activeElement).toBe(radio('C'));
  });

  it('ArrowLeft and ArrowUp select the previous radio and move focus to it', () => {
    render(<Harness initial="c" />);
    radio('C').focus();
    fireEvent.keyDown(radio('C'), { key: 'ArrowLeft' });
    expect(checkedLabel()).toBe('B');
    expect(document.activeElement).toBe(radio('B'));
    fireEvent.keyDown(radio('B'), { key: 'ArrowUp' });
    expect(checkedLabel()).toBe('A');
    expect(document.activeElement).toBe(radio('A'));
  });

  it('wraps around at both ends', () => {
    render(<Harness initial="c" />);
    radio('C').focus();
    fireEvent.keyDown(radio('C'), { key: 'ArrowRight' });
    expect(checkedLabel()).toBe('A');
    expect(document.activeElement).toBe(radio('A'));
    fireEvent.keyDown(radio('A'), { key: 'ArrowLeft' });
    expect(checkedLabel()).toBe('C');
    expect(document.activeElement).toBe(radio('C'));
  });

  it('Home and End jump to the ends; unrelated keys do nothing', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="b" />);
    radio('B').focus();
    fireEvent.keyDown(radio('B'), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(radio('B'), { key: 'End' });
    expect(checkedLabel()).toBe('C');
    fireEvent.keyDown(radio('C'), { key: 'Home' });
    expect(checkedLabel()).toBe('A');
  });

  it('keeps the group reachable when value matches no option', () => {
    render(<Harness initial="zzz" />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });
});

describe('colour-only cues', () => {
  it('Cue pairs a hidden glyph with screen-reader text that is not display:none', () => {
    render(<Cue glyph="▲" text="up on prior 12 months" />);
    const text = screen.getByText(/up on prior 12 months/);
    expect(text.className).toContain('sr-only');
    expect(text.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByText('▲').getAttribute('aria-hidden')).toBe('true');
  });
});

describe('patterns', () => {
  it('first series is solid; later ones reference a defined pattern id with no colons', () => {
    expect(patternFill('x:1:', 0, '#123456')).toBe('#123456');
    const f = patternFill('x:1:', 1, '#123456');
    expect(f).toBe(`url(#${patternId('x:1:', 1)})`);
    expect(f).not.toContain(':');
    const { container } = render(<svg>{patternDefs('x:1:', ['#111111', '#222222', '#333333'])}</svg>);
    expect(container.querySelectorAll('pattern')).toHaveLength(2);
    expect(container.querySelector(`#${patternId('x:1:', 2)}`)).toBeTruthy();
  });

  it('a Legend swatch with a pattern is an aria-hidden svg; a plain one is a coloured box', () => {
    const { container } = render(
      <Legend
        items={[
          { color: '#111111', label: 'One' },
          { color: '#222222', label: 'Two', pattern: 1 },
        ]}
      />,
    );
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('span.inline-block')).toHaveLength(1);
  });
});

describe('charts', () => {
  const data = chartData(rows, (r) => r.name, 'Shop', [{ name: 'Amount', get: (r) => r.amount }], 'shops');

  it('chartData builds a table and a summary naming the largest category', () => {
    expect(data.headers).toEqual(['Shop', 'Amount']);
    expect(data.rows[0]).toEqual(['Alpha Shop', 'KSh 300']);
    expect(data.summary).toContain('Alpha Shop');
    expect(data.summary).toContain('KSh 300');
    expect(chartData([] as Row[], (r) => r.name, 'Shop', [], 'shops').summary).toBe('No shops to chart.');
  });

  it('ChartCard has a heading, a described image, and the same data as a table', () => {
    render(
      <ChartCard title="Spend by shop" data={data}>
        <svg />
      </ChartCard>,
    );
    expect(screen.getByRole('heading', { name: 'Spend by shop' })).toBeTruthy();
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toContain(data.summary);
    expect(img.getAttribute('aria-label')).not.toBe('Spend by shop');
    const t = screen.getByRole('table', { hidden: true });
    expect(within(t).getByRole('rowheader', { name: 'Beta Bar', hidden: true })).toBeTruthy();
    expect(within(t).getByText('KSh 100')).toBeTruthy();
  });

  it('ChartCard heading level is configurable (default h3, h2 under the page title)', () => {
    const { rerender } = render(<ChartCard title="T">x</ChartCard>);
    expect(screen.getByRole('heading', { name: 'T' }).tagName).toBe('H3');
    rerender(
      <ChartCard title="T" headingLevel={2}>
        x
      </ChartCard>,
    );
    expect(screen.getByRole('heading', { name: 'T' }).tagName).toBe('H2');
  });

  it('points keyboard users at the data table, the intended keyboard path for charts', () => {
    render(
      <ChartCard title="Spend by shop" data={data}>
        <svg />
      </ChartCard>,
    );
    expect(screen.getByText(/works with a keyboard/)).toBeTruthy();
    expect(screen.getByText(/View the data behind this chart/).closest('summary')).toBeTruthy();
  });
});

describe('severity', () => {
  it('is conveyed as text, not only colour', () => {
    render(<SeverityLabel severity="High" />);
    expect(screen.getByText('High')).toBeTruthy();
  });
});

describe('contrast', () => {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const ratio = (fg: string, bg = '#ffffff') => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };

  it('COLORS.red meets WCAG AA (4.5:1) as text on white', () => {
    expect(ratio(COLORS.red)).toBeGreaterThanOrEqual(4.5);
  });
  it('Tailwind red-600 / amber-700 / gray-500 text colours meet AA on white', () => {
    for (const hex of ['#dc2626', '#b45309', '#6b7280']) expect(ratio(hex)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Upload', () => {
  const base: AppState = {
    parse: null,
    analysis: null,
    analysisError: null,
    settings: DEFAULT_SETTINGS,
    setSettings: () => {},
    loading: false,
    loadError: null,
    fileName: null,
    loadFile: async () => false,
    reset: () => {},
  };
  const renderUpload = (over: Partial<AppState> = {}) =>
    render(
      <MemoryRouter>
        <AppCtx.Provider value={{ ...base, ...over }}>
          <Upload />
        </AppCtx.Provider>
      </MemoryRouter>,
    );

  it('has a real, focusable button that opens the file picker (keyboard path)', () => {
    const { container } = renderUpload();
    const btn = screen.getByRole('button', { name: 'Choose a file' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('tabindex')).not.toBe('-1');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.getAttribute('aria-label')).toBe('Backup file');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(btn);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('exposes no div-with-onClick button role', () => {
    renderUpload();
    expect(screen.getAllByRole('button').every((el) => el.tagName === 'BUTTON')).toBe(true);
  });

  it('marks the drop zone aria-busy and announces progress while parsing', () => {
    const { container } = renderUpload({ loading: true });
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Reading and analysing');
    expect(screen.queryByRole('button', { name: 'Choose a file' })).toBeNull();
  });

  it('is not busy when idle and shows load errors as an alert', () => {
    const { container } = renderUpload({ loadError: 'That file is empty.' });
    expect(container.querySelector('[aria-busy="false"]')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('That file is empty.');
  });
});

describe('heading order on every page that uses ChartCard', () => {
  const NONE = { excludedPeople: [], extraBars: [] };
  const at = nairobi(2026, 5, 10, 23);
  const txns = [
    txn('send_person', nairobi(2026, 3, 1), 15000, { name: 'Beth Sample', phone: '0700000003' }),
    txn('recv_person', nairobi(2026, 3, 2), 500, { name: 'Beth Sample', phone: '0700000003' }),
    txn('till', at, 900, { name: 'Sample Lounge' }),
    txn('till', nairobi(2025, 5, 10, 23), 400, { name: 'Sample Lounge' }),
    txn('send_paybill', at, 700, { name: 'Test Paybill' }),
    txn('fuliza_draw', at, 2000, { fee: 20 }),
    txn('kcb_repay', at, 300),
  ];
  const analysis = analyze(parseResult(txns), NONE);
  const state: AppState = {
    parse: null,
    analysis,
    analysisError: null,
    settings: DEFAULT_SETTINGS,
    setSettings: () => {},
    loading: false,
    loadError: null,
    fileName: null,
    loadFile: async () => false,
    reset: () => {},
  };
  const pages: [string, () => JSX.Element][] = [
    ['Overview', Overview],
    ['Loans', Loans],
    ['Payees', Payees],
    ['People', People],
    ['Bars', Bars],
    ['Flags', Flags],
  ];

  beforeAll(() => {
    // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
    // It reports a fixed size so charts actually render their <defs>/<pattern> children (jsdom has no layout).
    globalThis.ResizeObserver = class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(target: Element) {
        const contentRect = { width: 600, height: 300, top: 0, left: 0, right: 600, bottom: 300, x: 0, y: 0 } as DOMRectReadOnly;
        this.cb([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    };
  });

  it.each(pages)('%s: one h1 first, and no heading level is skipped', (_name, Page) => {
    const { container } = render(
      <MemoryRouter>
        <AppCtx.Provider value={state}>
          <Page />
        </AppCtx.Provider>
      </MemoryRouter>,
    );
    const levels = [...container.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    levels.forEach((l, i) => {
      if (i > 0) expect(l, `h${l} follows h${levels[i - 1]}`).toBeLessThanOrEqual(levels[i - 1] + 1);
    });
    expect(levels.length).toBeGreaterThan(2);
  });

  const renderPage = (Page: () => JSX.Element) =>
    render(
      <MemoryRouter>
        <AppCtx.Provider value={state}>
          <Page />
        </AppCtx.Provider>
      </MemoryRouter>,
    );

  it('Loans: "Fuliza drawn" cells carry a non-colour cue only when fuliza > 0', () => {
    const { container } = renderPage(Loans);
    const table = [...container.querySelectorAll('table')].find((t) => t.textContent?.includes('Fuliza fees'))!;
    const headers = [...table.querySelectorAll('thead th')].map((h) => h.textContent ?? '');
    const col = headers.findIndex((h) => h.includes('Fuliza drawn'));
    const rows = [...table.querySelectorAll('tbody tr')];
    const cells = rows.map((r) => r.querySelectorAll('td')[col]);
    const withCue = cells.filter((c) => c.textContent?.includes('overdraft used this month'));
    const zero = cells.filter((c) => c.className.indexOf('text-red-600') === -1);
    expect(withCue.length).toBeGreaterThan(0);
    expect(zero.length).toBeGreaterThan(0);
    cells.forEach((c) => {
      const flagged = c.className.includes('text-red-600');
      expect(c.textContent?.includes('overdraft used this month')).toBe(flagged);
      expect(c.textContent?.includes('▲')).toBe(false);
      // sighted-monochrome half: the glyph itself must be present (and hidden from screen readers) when flagged
      expect(c.querySelector('[aria-hidden="true"]')?.textContent ?? null).toBe(flagged ? '●' : null);
    });
  });

  it('Payees: no two <pattern> elements share an id', () => {
    const { container } = renderPage(Payees);
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every page: no duplicate <pattern> ids', () => {
    const counts: Record<string, number> = {};
    pages.forEach(([name, Page]) => {
      const { container, unmount } = renderPage(Page);
      const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
      expect(new Set(ids).size, name).toBe(ids.length);
      counts[name] = ids.length;
      unmount();
    });
    // Non-vacuity: several pages render no patterns, so a per-page minimum would be wrong. Guard the total (17 with a working stub, 5 with a no-layout one)
    // and the pages known to chart multiple series, so a no-layout ResizeObserver stub fails loudly.
    expect(
      Object.values(counts).reduce((a, b) => a + b, 0),
      JSON.stringify(counts),
    ).toBeGreaterThanOrEqual(10);
    expect(counts.Payees, 'Payees renders two patterned charts').toBeGreaterThanOrEqual(2);
  });
});
