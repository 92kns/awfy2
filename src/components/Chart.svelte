<script lang="ts">
  import {
    Chart,
    type ChartConfiguration,
    type TooltipItem,
  } from 'chart.js/auto';
  import zoomPlugin from 'chartjs-plugin-zoom';
  import type {
    ChartMode,
    ChartPoint,
    ChartValueMode,
    GraphViewModel,
  } from '../domain/types';
  import {
    alertTooltipText,
    effectiveBaseline,
    pointTreeherderUrl,
    prepareChartSeries,
    shouldReverseYAxis,
    yAxisLabel,
  } from './chart-options';

  Chart.register(zoomPlugin);

  let {
    graph,
    visibleSeries,
    days = 30,
    chartMode = 'scatter',
    valueMode = 'absolute',
    baseline = null,
  }: {
    baseline?: string | null;
    chartMode?: ChartMode;
    days?: number;
    graph: GraphViewModel;
    valueMode?: ChartValueMode;
    visibleSeries: string[] | null;
  } = $props();
  let canvas: HTMLCanvasElement;
  let chartInstance: Chart<'scatter', ChartPoint[]> | undefined;

  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  });

  function chartPoint(item: TooltipItem<'scatter'>): ChartPoint | undefined {
    const value = item.dataset.data[item.dataIndex];
    return value && typeof value === 'object' && 'x' in value && 'y' in value
      ? (value as ChartPoint)
      : undefined;
  }

  function formatValue(value: number): string {
    const formatted = numberFormat.format(value);
    return valueMode === 'relative' ? `${formatted}%` : formatted;
  }

  function resetZoom(): void {
    chartInstance?.resetZoom();
  }

  $effect(() => {
    if (!canvas) return;

    const selectedBaseline = effectiveBaseline(graph.series, baseline);
    const datasets = prepareChartSeries(graph.series, {
      baseline: selectedBaseline,
      chartMode,
      valueMode,
    });
    const config: ChartConfiguration<'scatter', ChartPoint[]> = {
      type: 'scatter',
      data: {
        datasets: datasets.map((series) => ({
          backgroundColor: series.color,
          borderColor: series.color,
          borderDash: series.kind === 'median' ? [6, 4] : [],
          borderWidth:
            series.kind === 'median' ? 2 : chartMode === 'trend' ? 1.5 : 1,
          // Chart.js instruments dataset arrays. Copy points out of Svelte's
          // reactive proxy so that third-party mutation stays at the boundary.
          data: series.data.map((point) => ({ ...point })),
          hidden: visibleSeries
            ? !visibleSeries.includes(series.sourceLabel)
            : false,
          label: series.label,
          pointBackgroundColor: series.data.map((point) =>
            point.alert?.kind === 'regression'
              ? '#ef476f'
              : point.alert
                ? '#f7b955'
                : series.color,
          ),
          pointBorderColor: series.data.map((point) =>
            point.alert ? '#ffffff' : series.color,
          ),
          pointBorderWidth: series.data.map((point) => (point.alert ? 1.5 : 0)),
          pointHoverRadius: series.kind === 'median' ? 3 : 5,
          pointRadius:
            series.kind === 'median'
              ? 0
              : series.data.map((point) => (point.alert ? 4.5 : 1.8)),
          pointStyle: series.data.map((point) =>
            point.alert?.kind === 'regression'
              ? 'triangle'
              : point.alert
                ? 'rectRot'
                : 'circle',
          ),
          showLine: chartMode !== 'scatter' || series.kind === 'median',
        })),
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        normalized: true,
        onClick: (_event, elements, chart) => {
          const selected = elements[0];
          if (!selected) return;
          const point = chart.data.datasets[selected.datasetIndex]?.data[
            selected.index
          ] as ChartPoint | undefined;
          const url = point
            ? pointTreeherderUrl(point, graph.project)
            : undefined;
          if (url) window.open(url, '_blank', 'noopener');
        },
        onHover: (event, elements) => {
          const target = event.native?.target;
          if (target instanceof HTMLCanvasElement) {
            target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
          }
        },
        parsing: false,
        interaction: { intersect: false, mode: 'nearest' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: (item) => alertTooltipText(chartPoint(item)?.alert),
              label: (item) =>
                `${item.dataset.label ?? 'Series'}: ${formatValue(item.parsed.y ?? 0)}`,
              title: (items) =>
                items[0]
                  ? new Date(items[0].parsed.x ?? 0).toLocaleString()
                  : '',
            },
          },
          zoom: {
            limits: {
              x: { max: 'original', min: 'original' },
              y: { max: 'original', min: 'original' },
            },
            pan: { enabled: true, mode: 'xy' },
            zoom: {
              mode: 'xy',
              pinch: { enabled: true },
              wheel: { enabled: true, modifierKey: 'ctrl' },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              callback: (value) => dateFormat.format(new Date(Number(value))),
              maxTicksLimit: 10,
            },
            title: { display: false },
          },
          y: {
            // Keep improvement visually consistent: higher scores go up, and
            // lower durations go up on a reversed axis.
            reverse: shouldReverseYAxis(graph.lowerIsBetter),
            ticks: {
              callback: (value) => formatValue(Number(value)),
            },
            title: {
              display: true,
              text: yAxisLabel(graph.yLabel, valueMode, selectedBaseline),
            },
          },
        },
      },
    };

    const chart = new Chart(canvas, config);
    chartInstance = chart;
    return () => {
      if (chartInstance === chart) chartInstance = undefined;
      chart.destroy();
    };
  });
</script>

<div class="chart-toolbar" aria-label="Chart navigation">
  <button type="button" onclick={resetZoom}>Reset zoom</button>
  <span id={`chart-help-${graph.id}`}>
    {days}-day view. Ctrl + mouse wheel to zoom; drag to pan. Click a marked
    point to open its Treeherder push.
  </span>
</div>
<div class="chart-container">
  <canvas
    bind:this={canvas}
    aria-describedby={`chart-help-${graph.id}`}
    aria-label={`${graph.title} performance chart`}
  ></canvas>
</div>

<style>
  .chart-toolbar {
    align-items: center;
    color: var(--muted);
    display: flex;
    font-size: 0.72rem;
    gap: 0.65rem;
    justify-content: end;
    margin-bottom: 0.4rem;
  }

  .chart-toolbar button {
    background: var(--control);
    border: 1px solid var(--border-strong);
    border-radius: 0.35rem;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0.2rem 0.45rem;
  }

  .chart-toolbar button:hover {
    border-color: var(--accent);
  }

  .chart-container {
    height: clamp(18rem, 38vw, 30rem);
    min-width: 0;
    position: relative;
  }

  @media (max-width: 650px) {
    .chart-toolbar {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
