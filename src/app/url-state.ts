import type { DashboardPreset } from '../domain/types';

export interface AppSelection {
  benchmark: string;
  category: string;
  days: number;
  platform: string;
  visibleSeries: string[] | null;
}

export function readSelection(preset: DashboardPreset, url: URL): AppSelection {
  const requestedPlatform = url.searchParams.get('platform');
  const platform =
    requestedPlatform && preset.config.views[requestedPlatform]
      ? requestedPlatform
      : preset.config.default.platform;
  const view = preset.config.views[platform]!;

  const requestedCategory = url.searchParams.get('category');
  const category =
    requestedCategory && view.categories[requestedCategory]
      ? requestedCategory
      : preset.config.default.category;
  const categoryPreset =
    view.categories[category] ?? Object.values(view.categories)[0]!;

  const requestedBenchmark = url.searchParams.get('benchmark') ?? 'overview';
  const benchmark =
    requestedBenchmark === 'overview' ||
    categoryPreset.suites.includes(requestedBenchmark)
      ? requestedBenchmark
      : 'overview';

  const requestedDays = Number(url.searchParams.get('days'));
  const days = preset.config.dayRange.includes(requestedDays)
    ? requestedDays
    : preset.config.default.dayRange;
  const series = url.searchParams.get('series');

  return {
    benchmark,
    category,
    days,
    platform,
    visibleSeries: series ? series.split(',').filter(Boolean) : null,
  };
}

export function selectionUrl(selection: AppSelection, current: URL): URL {
  const url = new URL(current);
  url.search = '';
  url.hash = '';
  url.searchParams.set('platform', selection.platform);
  url.searchParams.set('category', selection.category);
  url.searchParams.set('benchmark', selection.benchmark);
  url.searchParams.set('days', String(selection.days));
  if (selection.visibleSeries) {
    url.searchParams.set('series', selection.visibleSeries.join(','));
  }
  return url;
}
