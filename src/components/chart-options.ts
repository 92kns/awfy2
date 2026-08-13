import {
  relativeToBaselinePercent,
  rollingMedian,
} from '../domain/chart-transforms';
import type {
  ChartMode,
  ChartPoint,
  ChartSeries,
  ChartValueMode,
  PerformanceAlert,
} from '../domain/types';

export interface ChartDisplayOptions {
  baseline?: string | null | undefined;
  chartMode?: ChartMode | undefined;
  valueMode?: ChartValueMode | undefined;
}

export interface PreparedChartSeries {
  color: string;
  data: ChartPoint[];
  kind: 'points' | 'median';
  label: string;
  sourceLabel: string;
}

/**
 * Alerts are filed against a push, so a revision is the most reliable link to a
 * datum: an alert summary and a performance datum for the same push do not
 * always share a timestamp once retriggers and backfills are involved.
 */
function alertForPoint(
  point: ChartPoint,
  alerts: readonly PerformanceAlert[] | undefined,
): PerformanceAlert | undefined {
  if (point.alert) return point.alert;
  if (!alerts?.length) return undefined;
  return (
    alerts.find(
      (alert) =>
        alert.revision != null &&
        point.revision != null &&
        alert.revision === point.revision,
    ) ??
    alerts.find(
      (alert) => alert.datumId != null && alert.datumId === point.datumId,
    ) ??
    alerts.find(
      (alert) => alert.timestamp != null && alert.timestamp === point.x,
    )
  );
}

function copiedSeries(series: readonly ChartSeries[]): ChartSeries[] {
  return series.map((candidate) => ({
    ...candidate,
    data: candidate.data.map((point) => {
      const alert = alertForPoint(point, candidate.alerts);
      return { ...point, ...(alert ? { alert } : {}) };
    }),
  }));
}

/**
 * Resolves the baseline actually usable for these series.
 *
 * A shared URL can name a baseline that this graph does not contain, for
 * example after switching benchmark or project. Falling back to the first
 * series keeps relative mode honest: the axis label and the plotted values
 * always describe the same baseline.
 */
export function effectiveBaseline(
  series: readonly ChartSeries[],
  baseline: string | null | undefined,
): string | undefined {
  if (baseline != null && series.some((entry) => entry.label === baseline)) {
    return baseline;
  }
  return series[0]?.label;
}

export function prepareChartSeries(
  series: readonly ChartSeries[],
  options: ChartDisplayOptions = {},
): PreparedChartSeries[] {
  const chartMode = options.chartMode ?? 'scatter';
  const valueMode = options.valueMode ?? 'absolute';
  const baseline = effectiveBaseline(series, options.baseline);
  const copied = copiedSeries(series);
  const transformed =
    valueMode === 'relative'
      ? relativeToBaselinePercent(copied, baseline)
      : copied;
  const points = transformed.map((candidate) => ({
    color: candidate.color,
    data: candidate.data.map((point) => ({ ...point })),
    kind: 'points' as const,
    label: candidate.label,
    sourceLabel: candidate.label,
  }));

  if (chartMode !== 'median') return points;
  return points.flatMap((candidate) => [
    candidate,
    {
      ...candidate,
      data: rollingMedian(candidate.data),
      kind: 'median' as const,
      label: `${candidate.label} median`,
    },
  ]);
}

export function yAxisLabel(
  absoluteLabel: string,
  valueMode: ChartValueMode = 'absolute',
  baseline?: string | null,
): string {
  if (valueMode === 'absolute') return absoluteLabel;
  return baseline ? `% vs ${baseline}` : 'Relative difference (%)';
}

export function shouldReverseYAxis(lowerIsBetter?: boolean): boolean {
  return lowerIsBetter === true;
}

export function pointTreeherderUrl(
  point: ChartPoint,
  project?: string,
): string | undefined {
  if (point.revisionUrl) return point.revisionUrl;
  if (point.pushUrl) return point.pushUrl;
  if (!point.revision) return undefined;

  const url = new URL('https://treeherder.mozilla.org/jobs');
  url.searchParams.set('repo', project ?? 'mozilla-central');
  url.searchParams.set('revision', point.revision);
  return url.toString();
}

export function alertTooltipText(alert: PerformanceAlert | undefined): string {
  if (!alert) return '';
  const label = alert.kind === 'regression' ? 'Regression' : 'Alert';
  return alert.summary ? `${label}: ${alert.summary}` : label;
}
