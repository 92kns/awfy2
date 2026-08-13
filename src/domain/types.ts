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
  includeAlerts: boolean;
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
  /** Treeherder's own unit for the series, for example `ms`, `score`, `bytes`. */
  measurementUnit?: string | undefined;
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

/**
 * A regression or improvement marker associated with one graph signature.
 *
 * `amountPct` is Treeherder's own magnitude and is never negative, so the
 * direction of the change has to come from `isRegression` or from
 * `prevValue`/`newValue`.  Alert and summary triage states are distinct: an
 * alert can be reassigned to another summary, in which case
 * `relatedSummaryId` is the summary that owns the discussion.
 */
export interface PerformanceAlertMarker {
  alertId: number;
  alertStatus: number;
  amountPct?: number | undefined;
  bugNumber?: number | undefined;
  isRegression: boolean;
  newValue?: number | undefined;
  prevValue?: number | undefined;
  relatedSummaryId?: number | undefined;
  revision: string;
  seriesSignatureId: number;
  summaryId: number;
  summaryStatus: number;
  timestamp: number;
}

export interface SeriesQuerySuccess {
  graphs: PerformanceGraph[];
  series: ResolvedSeries;
  status: 'success';
  /**
   * Non-fatal degradations, such as alert markers that could not be loaded or
   * were truncated. The data is still usable, so these are surfaced as warnings
   * rather than as failures.
   */
  warnings?: string[] | undefined;
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
  /** Push revision the alert was filed against, used to match a datum. */
  revision?: string | undefined;
  summary?: string | undefined;
  timestamp?: number | undefined;
  /** Perfherder alert-summary link, so the alert is reachable by keyboard. */
  url?: string | undefined;
}

export interface ChartPoint {
  alert?: PerformanceAlert | undefined;
  datumId?: number | undefined;
  jobId?: number | string | undefined;
  /** Machine platform the point came from, kept through alias merges. */
  platform?: string | undefined;
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
  /** Machine platforms whose data was merged into this graph, in view order. */
  sources?: readonly string[] | undefined;
  subtitle?: string | undefined;
  title: string;
  yLabel: string;
}

export interface BenchmarkLoadResult {
  benchmarkId: string;
  errors: SeriesQueryFailure[];
  graphs: GraphViewModel[];
  label: string;
  /** Deduplicated non-fatal degradations gathered from every series. */
  warnings: string[];
}
