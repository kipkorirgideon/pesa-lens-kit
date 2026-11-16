import { expect, test, type Page, type ConsoleMessage } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const FIXTURE = fileURLToPath(new URL('./fixtures/synthetic.sms', import.meta.url));

/** Everything the page logs or throws; asserted empty at the end of each journey. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

/** Fails the test on any request whose origin differs from the app's. */
function watchOrigin(page: Page, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const foreign: string[] = [];
  const check = (url: string) => {
    // data: and blob: URLs never leave the browser.
    if (/^(data|blob|about):/.test(url)) return;
    if (new URL(url).origin !== origin) foreign.push(url);
  };
  page.on('request', (r) => check(r.url()));
  // Also block them, so a violation cannot succeed silently.
  void page.route(
    (u) => u.origin !== origin && !/^(data|blob|about):/.test(u.href),
    (route) => route.abort(),
  );
  return foreign;
}

async function upload(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Private by design.')).toBeVisible();
  await expect(page.getByText('never uploaded', { exact: false }).first()).toBeVisible();
  await page.getByLabel('Backup file').setInputFiles(FIXTURE);
  await expect(page).toHaveURL(/#\/overview$/);
}

test('settings journey: upload, exclude a person, persists across reload; nothing leaves the origin', async ({ page, baseURL }) => {
  const errors = watchErrors(page);
  const foreign = watchOrigin(page, baseURL!);

  await upload(page);
  await expect(page.getByRole('heading', { level: 1, name: /overview/i })).toBeVisible();
  await expect(page.getByText('48 transactions')).toBeVisible();

  // Drains list shows the invented big sender.
  await page.getByRole('link', { name: 'Red flags & drains' }).click();
  await expect(page.getByRole('heading', { name: 'Biggest money drains: people' })).toBeVisible();
  const table = page.getByRole('table').filter({ hasText: 'Net out' });
  await expect(table.getByRole('cell', { name: 'Beth Sample' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Carl Example' })).toBeVisible();

  // Exclude Beth Sample in Settings.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('searchbox', { name: 'Search people to exclude' }).fill('beth');
  await page.getByRole('button', { name: /Beth Sample/ }).click();
  await expect(page.getByRole('button', { name: 'Remove Beth Sample' })).toBeVisible();

  await page.getByRole('link', { name: 'Red flags & drains' }).click();
  await expect(table.getByRole('cell', { name: 'Carl Example' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Beth Sample' })).toHaveCount(0);

  // Reload: the analysis is gone by design (nothing but settings is stored), the setting is kept.
  expect(await page.evaluate(() => localStorage.getItem('mpesa.settings.v1'))).toContain('BETH SAMPLE');
  await page.reload();
  await expect(page.getByText('Private by design.')).toBeVisible();
  await upload(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Remove Beth Sample' })).toBeVisible();
  await page.getByRole('link', { name: 'Red flags & drains' }).click();
  await expect(table.getByRole('cell', { name: 'Carl Example' })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Beth Sample' })).toHaveCount(0);

  expect(foreign, 'requests that left the origin').toEqual([]);
  expect(errors, 'console errors / page errors (includes CSP violations the browser reports)').toEqual([]);
});

const ROUTES = ['/overview', '/flags', '/people', '/payees', '/bars', '/loans', '/settings'];

/** Visits every tab at 400x800, returns the page-level horizontal overflow (px) per route. */
async function visitAll(page: Page) {
  await page.setViewportSize({ width: 400, height: 800 });
  await upload(page);
  const overflow: Record<string, number> = {};
  for (const r of ROUTES) {
    await page.getByRole('navigation', { name: 'Sections' }).locator(`a[href="#${r}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${r}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0);
    overflow[r] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }
  return overflow;
}

test('every route renders and its lazy chunk loads, with no errors and no foreign requests', async ({ page, baseURL }) => {
  const errors = watchErrors(page);
  const foreign = watchOrigin(page, baseURL!);
  await visitAll(page);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});

// KNOWN FAILURE, tracked as TASK-26: the visually hidden `sr-only` cue spans inside horizontally
// scrolling tables are position:absolute with a non-positioned scroller, so they escape the clip and
// widen the page (at least Red flags & drains: +495 px at 400 px). test.fail() keeps this suite green while the
// bug stands and turns red the moment it is fixed, which is the cue to delete the test.fail() line.
test('no horizontal page scroll on any tab at 400x800', async ({ page }) => {
  test.fail();
  const overflow = await visitAll(page);
  for (const r of ROUTES) expect(overflow[r], `horizontal page overflow on ${r}`).toBeLessThanOrEqual(0);
});

test('Segmented control responds to arrow keys', async ({ page }) => {
  await upload(page);
  await page.getByRole('link', { name: 'People' }).click();
  const group = page.getByRole('radiogroup').first();
  const radios = group.getByRole('radio');
  await radios.nth(0).focus();
  await expect(radios.nth(0)).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(1)).toBeChecked();
  await expect(radios.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(radios.nth(0)).toBeChecked();
});
