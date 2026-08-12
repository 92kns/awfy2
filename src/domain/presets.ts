import type {
  BenchmarkMap,
  BenchmarkQuery,
  CategoryMap,
  ResolvedSeries,
  SeriesTemplate,
  ViewPreset,
} from './types';

export function resolveSeries(
  series: SeriesTemplate,
  view: ViewPreset,
): ResolvedSeries[] {
  const project = view.project ?? series.project;

  if (series.platform) {
    return [
      { ...series, ...(project ? { project } : {}), platform: series.platform },
    ];
  }

  return view.platforms.map((platform) => ({
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
): BenchmarkQuery[] {
  const category = view.categories[categoryId];
  if (!category) return [];

  const ids = benchmarkId === 'overview' ? category.suites : [benchmarkId];

  return ids.flatMap((id) => {
    const benchmark = benchmarks[id];
    if (!benchmark) return [];

    const series = Object.values(benchmark.compare).flatMap((entry) =>
      resolveSeries(entry, view),
    );

    return [
      {
        benchmarkId: id,
        ...(benchmark.docUrl ? { docUrl: benchmark.docUrl } : {}),
        includeSubtests: benchmarkId !== 'overview',
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
