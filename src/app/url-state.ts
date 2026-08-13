import type { DashboardPreset } from '../domain/types';

export const DETAIL_MODES = ['summary', 'subtests'] as const;
export type DetailMode = (typeof DETAIL_MODES)[number];

export const PROJECT_MODES = [
  'configured',
  'autoland',
  'mozilla-central',
] as const;
export type ProjectMode = (typeof PROJECT_MODES)[number];

export const CHART_MODES = ['scatter', 'trend', 'median'] as const;
export type ChartMode = (typeof CHART_MODES)[number];

export const VALUE_MODES = ['absolute', 'relative'] as const;
export type ValueMode = (typeof VALUE_MODES)[number];

export interface AppSelection {
  benchmark: string;
  category: string;
  chart: ChartMode;
  days: number;
  detail: DetailMode;
  platform: string;
  baseline: string | null;
  project: ProjectMode;
  subtestSearch: string;
  values: ValueMode;
  visibleSeries: string[] | null;
}

function enumValue<T extends string>(
  value: string | null,
  values: readonly T[],
  fallback: T,
): T {
  return value && values.includes(value as T) ? (value as T) : fallback;
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
      : view.categories[preset.config.default.category]
        ? preset.config.default.category
        : Object.keys(view.categories)[0]!;
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
  const benchmarkIds =
    benchmark === 'overview' ? categoryPreset.suites : [benchmark];
  const availableBaselines = new Set(
    benchmarkIds.flatMap((id) =>
      Object.values(preset.benchmarks[id]?.compare ?? {}).map(
        (series) => series.label,
      ),
    ),
  );
  const requestedBaseline = url.searchParams.get('baseline');
  const baseline =
    requestedBaseline && availableBaselines.has(requestedBaseline)
      ? requestedBaseline
      : null;

  return {
    benchmark,
    category,
    chart: enumValue(url.searchParams.get('chart'), CHART_MODES, 'scatter'),
    days,
    detail: enumValue(url.searchParams.get('detail'), DETAIL_MODES, 'summary'),
    platform,
    baseline,
    project: enumValue(
      url.searchParams.get('project'),
      PROJECT_MODES,
      'configured',
    ),
    subtestSearch:
      url.searchParams.get('subtest') ??
      url.searchParams.get('subtestSearch') ??
      '',
    values: enumValue(url.searchParams.get('values'), VALUE_MODES, 'absolute'),
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
  url.searchParams.set('detail', selection.detail);
  url.searchParams.set('project', selection.project);
  url.searchParams.set('chart', selection.chart);
  url.searchParams.set('values', selection.values);
  if (selection.baseline) {
    url.searchParams.set('baseline', selection.baseline);
  }
  if (selection.visibleSeries) {
    url.searchParams.set('series', selection.visibleSeries.join(','));
  }
  if (selection.subtestSearch) {
    url.searchParams.set('subtest', selection.subtestSearch);
  }
  return url;
}
