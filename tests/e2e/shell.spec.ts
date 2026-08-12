import { expect, test } from '@playwright/test';

test('loads the dashboard shell and persists controls in the URL', async ({
  page,
}) => {
  await page.route('https://treeherder.mozilla.org/**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      json: url.pathname.includes('optioncollectionhash') ? [] : {},
    });
  });
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Are We Fast Yet?' }),
  ).toBeVisible();
  await page.getByLabel('Time range').selectOption('30');
  await expect(page).toHaveURL(/days=30/);
  await expect(
    page.getByText(/configured series could not be loaded/),
  ).toBeVisible();
});

test('renders Treeherder data without leaking Svelte proxies into Chart.js', async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.route('https://treeherder.mozilla.org/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('optioncollectionhash')) {
      await route.fulfill({
        contentType: 'application/json',
        json: [
          {
            option_collection_hash: 'opt-hash',
            options: [{ name: 'opt' }],
          },
        ],
      });
      return;
    }
    if (url.pathname.endsWith('/performance/data/')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          'displaylist-hash': [
            { id: 1, push_timestamp: 1_787_000_000, value: 42 },
            { id: 2, push_timestamp: 1_787_086_400, value: 41 },
          ],
        },
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      json: {
        'displaylist-hash': {
          application: 'firefox',
          extra_options: ['e10s', 'stylo', 'fission', 'webrender'],
          framework_id: 1,
          has_subtests: false,
          id: 101,
          lower_is_better: true,
          machine_platform: url.searchParams.get('platform'),
          option_collection_hash: 'opt-hash',
          signature_hash: 'displaylist-hash',
          suite: 'displaylist_mutate',
          test: null,
        },
      },
    });
  });

  await page.goto(
    '/?platform=win11&category=benchmarks&benchmark=displaylist_mutate&days=30',
  );
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('Firefox', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
