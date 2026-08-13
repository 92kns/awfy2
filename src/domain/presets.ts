import type {
  BenchmarkMap,
  BenchmarkQuery,
  CategoryMap,
  ResolvedSeries,
  SeriesTemplate,
  ViewPreset,
} from './types';

export interface BenchmarkQueryOptions {
  detail?: 'summary' | 'subtests';
  project?: 'configured' | 'autoland' | 'mozilla-central';
}

export function resolveSeries(
  series: SeriesTemplate,
  view: ViewPreset,
  projectOverride: BenchmarkQueryOptions['project'] = 'configured',
): ResolvedSeries[] {
  const project =
    projectOverride !== 'configured'
      ? projectOverride
      : (view.project ?? series.project);
  const platforms = series.platform ? [series.platform] : view.platforms;

  return platforms
    .filter(
      (platform) =>
        !series.applicablePlatforms ||
        series.applicablePlatforms.includes(platform),
    )
    .map((platform) => ({
      ...series,
      ...(project ? { project } : {}),
      platform: series.platformSuffix
        ? `${platform}${series.platformSuffix}`
        : platform,
    }));
}

export function buildBenchmarkQueries(
  benchmarks: BenchmarkMap,
  view: ViewPreset,
  benchmarkId: string,
  categoryId: string,
  options: BenchmarkQueryOptions = {},
): BenchmarkQuery[] {
  const category = view.categories[categoryId];
  if (!category) return [];

  const ids = benchmarkId === 'overview' ? category.suites : [benchmarkId];

  return ids.flatMap((id) => {
    const benchmark = benchmarks[id];
    if (!benchmark) return [];

    const series = Object.values(benchmark.compare).flatMap((entry) =>
      resolveSeries(entry, view, options.project),
    );

    return [
      {
        benchmarkId: id,
        ...(benchmark.docUrl ? { docUrl: benchmark.docUrl } : {}),
        includeSubtests:
          benchmarkId !== 'overview' && options.detail === 'subtests',
        label: benchmark.label,
        series,
        ...(benchmark.yLabel ? { yLabel: benchmark.yLabel } : {}),
      },
    ];
  });
}

export function validatePresetReferences(
  benchmarks: BenchmarkMap,
  categories: CategoryMap,
): string[] {
  return Object.entries(categories).flatMap(([categoryId, category]) =>
    category.suites
      .filter((suite) => !benchmarks[suite])
      .map((suite) => `${categoryId}: missing benchmark ${suite}`),
  );
}
