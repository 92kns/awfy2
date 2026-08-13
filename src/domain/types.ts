export const TREEHERDER_PROJECTS = ['mozilla-central', 'autoland'] as const;

export type TreeherderProject = (typeof TREEHERDER_PROJECTS)[number] | string;

export interface SeriesTemplate {
  /**
   * View machine-platform IDs on which this series is expected to exist.
   *
   * This is applied before `platformSuffix`, so presets can describe valid
   * combinations without expanding queries for every platform in a view.
   */
  applicablePlatforms?: readonly string[] | undefined;
  application?: string | undefined;
  color: string;
  extraOptions?: string[] | undefined;
  frameworkId: number;
  label: string;
  option: string;
  platform?: string | undefined;
  platformSuffix?: string | undefined;
  project?: TreeherderProject | undefined;
  suite: string;
  suiteSuffix?: string | undefined;
  test?: string | undefined;
}

export interface ResolvedSeries extends SeriesTemplate {
  platform: string;
}

export interface BenchmarkPreset {
  compare: Record<string, SeriesTemplate>;
  docUrl?: string | undefined;
  label: string;
  yLabel?: string | undefined;
}

export type BenchmarkMap = Record<string, BenchmarkPreset>;

export interface CategoryPreset {
  label: string;
  suites: string[];
}

export type CategoryMap = Record<string, CategoryPreset>;

export interface ViewPreset {
  categories: CategoryMap;
  label: string;
  platforms: string[];
  project?: TreeherderProject | undefined;
}

export interface DashboardConfig {
  dayRange: number[];
  default: {
    category: string;
    dayRange: number;
    platform: string;
  };
  views: Record<string, ViewPreset>;
}

export interface DashboardPreset {
  benchmarks: BenchmarkMap;
  config: DashboardConfig;
  id: string;
  maxDayRange: number;
  title: string;
}

export interface BenchmarkQuery {
  benchmarkId: string;
  docUrl?: string | undefined;
  includeSubtests: boolean;
  label: string;
  series: ResolvedSeries[];
  yLabel?: string | undefined;
}

export interface Datum {
  datumId: number;
  jobId: number;
  pushId: number;
  pushUrl: string;
  revision: string;
  timestamp: number;
  value: number;
}

export interface Signature {
  application?: string | undefined;
  extraOptions?: string[] | undefined;
  frameworkId: number;
  hasSubtests: boolean;
  id: number;
  lowerIsBetter?: boolean | undefined;
  machinePlatform?: string | undefined;
  optionCollectionHash: string;
  signatureHash: string;
  suite: string;
  test: string;
}

export type SignatureResolution =
  | { status: 'resolved'; signature: Signature }
  | { status: 'not-found'; candidates: Signature[] }
  | { status: 'ambiguous'; candidates: Signature[] };

export interface PerformanceGraph {
  alerts: PerformanceAlertMarker[];
  data: Datum[];
  meta: Signature;
  perfherderUrl: string;
}

/** A regression or improvement marker associated with one graph signature. */
export interface PerformanceAlertMarker {
  amountPct?: number | undefined;
  bugNumber?: number | undefined;
  isRegression: boolean;
  newValue?: number | undefined;
  prevValue?: number | undefined;
  revision: string;
  seriesSignatureId: number;
  status: number;
  summaryId: number;
  timestamp: number;
}

export interface SeriesQuerySuccess {
  graphs: PerformanceGraph[];
  series: ResolvedSeries;
  status: 'success';
}

export interface SeriesQueryFailure {
  candidates?: Signature[] | undefined;
  message: string;
  series: ResolvedSeries;
  status: 'not-found' | 'ambiguous' | 'invalid-response' | 'network-error';
}

export type SeriesQueryResult = SeriesQuerySuccess | SeriesQueryFailure;

export type ChartMode = 'scatter' | 'trend' | 'median';

export type ChartValueMode = 'absolute' | 'relative';

export type AlertKind = 'alert' | 'regression';

/**
 * A marker associated with a performance point.  The data-fetching layer can
 * supply whichever identifier Treeherder exposes; rendering matches a marker
 * by datum id first and timestamp second.
 */
export interface PerformanceAlert {
  datumId?: number | undefined;
  kind: AlertKind;
  summary?: string | undefined;
  timestamp?: number | undefined;
}

export interface ChartPoint {
  alert?: PerformanceAlert | undefined;
  datumId?: number | undefined;
  jobId?: number | string | undefined;
  pushId?: number | string | undefined;
  pushUrl?: string | undefined;
  revision?: string | undefined;
  revisionUrl?: string | undefined;
  x: number;
  y: number;
}

export interface ChartSeries {
  alerts?: PerformanceAlert[] | undefined;
  color: string;
  data: ChartPoint[];
  label: string;
}

export interface GraphViewModel {
  docUrl?: string | undefined;
  id: string;
  lowerIsBetter?: boolean | undefined;
  perfherderUrl: string;
  project?: TreeherderProject | undefined;
  series: ChartSeries[];
  subtitle?: string | undefined;
  title: string;
  yLabel: string;
}

export interface BenchmarkLoadResult {
  benchmarkId: string;
  errors: SeriesQueryFailure[];
  graphs: GraphViewModel[];
  label: string;
}
