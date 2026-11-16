// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataTable, type Column } from './DataTable';
import { Picker } from './Picker';
import { ChartCard, Segmented, SeverityLabel } from './ui';
import { chartData } from './chartUtils';
import Upload from '../pages/Upload';
import { AppCtx, type AppState } from '../state';
import { COLORS } from '../lib/format';
import { DEFAULT_SETTINGS } from '../lib/types';

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

describe('Segmented', () => {
  it('uses toggle buttons with aria-pressed inside a labelled group', () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Rank by"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    const group = screen.getByRole('group', { name: 'Rank by' });
    expect(within(group).getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true');
    const b = within(group).getByRole('button', { name: 'B' });
    expect(b.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith('b');
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
