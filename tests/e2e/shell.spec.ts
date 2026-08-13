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
    page.getByText(/configured comparison[s]? need attention/),
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
    if (url.pathname === '/api/repository/') {
      await route.fulfill({
        contentType: 'application/json',
        json: [{ id: 77, name: 'autoland' }],
      });
      return;
    }
    if (url.pathname === '/api/performance/alertsummary/') {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          count: 1,
          next: null,
          results: [
            {
              alerts: [
                {
                  amount_pct: 2.38,
                  id: 9001,
                  is_regression: true,
                  new_value: 41,
                  prev_value: 42,
                  related_summary_id: null,
                  series_signature: { id: 101 },
                  status: 0,
                },
                {
                  // Invalid alerts must not be drawn or linked.
                  amount_pct: 50,
                  id: 9002,
                  is_regression: true,
                  new_value: 60,
                  prev_value: 40,
                  related_summary_id: null,
                  series_signature: { id: 101 },
                  status: 3,
                },
              ],
              bug_number: 1900001,
              id: 4242,
              push_timestamp: 1_787_086_400,
              revision: 'revision-two',
              status: 0,
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/performance/data/')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          'displaylist-hash': [
            {
              id: 1,
              job_id: 11,
              push_id: 21,
              push_timestamp: 1_787_000_000,
              revision: 'revision-one',
              value: 42,
            },
            {
              id: 2,
              job_id: 12,
              push_id: 22,
              push_timestamp: 1_787_086_400,
              revision: 'revision-two',
              value: 41,
            },
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
  await expect(
    page.getByLabel('Chart series').getByText('Firefox', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  expect(pageErrors).toEqual([]);

  // Chart points respond to a pointer only, so alerts and pushes must also be
  // reachable as ordinary keyboard-focusable links.
  await page.getByText('Alerts and recent pushes').click();
  const alertLink = page.getByRole('link', {
    name: /Regression \(−2\.38%\) · Bug 1900001/,
  });
  await expect(alertLink).toHaveAttribute(
    'href',
    'https://treeherder.mozilla.org/perfherder/alerts?id=4242',
  );
  await alertLink.focus();
  await expect(alertLink).toBeFocused();
  await expect(
    page.getByRole('link', { name: /revision-two/ }).first(),
  ).toHaveAttribute(
    'href',
    'https://treeherder.mozilla.org/jobs?repo=autoland&revision=revision-two',
  );
  // The invalid alert contributes no marker and therefore no link.
  await expect(page.getByRole('link', { name: /50\.00%/ })).toHaveCount(0);
});

test('degrades visibly, not silently, when alert enrichment fails', async ({
  page,
}) => {
  await page.route('https://treeherder.mozilla.org/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('optioncollectionhash')) {
      await route.fulfill({
        contentType: 'application/json',
        json: [
          { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
        ],
      });
      return;
    }
    // Alerts are an enrichment: losing them must warn, not blank the graph.
    if (
      url.pathname === '/api/repository/' ||
      url.pathname === '/api/performance/alertsummary/'
    ) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        json: {},
      });
      return;
    }
    if (url.pathname.endsWith('/performance/data/')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          'displaylist-hash': [
            {
              id: 1,
              job_id: 11,
              push_id: 21,
              push_timestamp: 1_787_000_000,
              revision: 'revision-one',
              value: 42,
            },
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
  const warnings = page
    .getByLabel('Data warnings')
    .getByText(/Regression and improvement markers are unavailable/);
  await expect(warnings).toBeVisible();
  // One shared cause reports once, however many series it affected.
  await expect(warnings).toHaveCount(1);
});

test('never presents absolute values under a percent axis', async ({
  page,
}) => {
  await page.route('https://treeherder.mozilla.org/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('optioncollectionhash')) {
      await route.fulfill({
        contentType: 'application/json',
        json: [
          { option_collection_hash: 'opt-hash', options: [{ name: 'opt' }] },
        ],
      });
      return;
    }
    if (url.pathname === '/api/repository/') {
      await route.fulfill({
        contentType: 'application/json',
        json: [{ id: 77, name: 'autoland' }],
      });
      return;
    }
    if (url.pathname === '/api/performance/alertsummary/') {
      await route.fulfill({
        contentType: 'application/json',
        json: { count: 0, next: null, results: [] },
      });
      return;
    }
    if (url.pathname.endsWith('/performance/data/')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          'displaylist-hash': [
            {
              id: 1,
              job_id: 11,
              push_id: 21,
              push_timestamp: 1_787_000_000,
              revision: 'revision-one',
              value: 42,
            },
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
    '/?platform=win11&category=benchmarks&benchmark=displaylist_mutate&days=30&values=relative',
  );

  await expect(page.locator('canvas')).toBeVisible();
  // The strip beside a percent axis is absolute, so it has to say so.
  await expect(
    page.getByText(/Absolute .*the chart above shows % vs/),
  ).toBeVisible();
});
