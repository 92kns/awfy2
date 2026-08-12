<script lang="ts">
  import { Chart, type ChartConfiguration } from 'chart.js/auto';
  import type { GraphViewModel } from '../domain/types';

  let {
    graph,
    visibleSeries,
  }: { graph: GraphViewModel; visibleSeries: string[] | null } = $props();
  let canvas: HTMLCanvasElement;

  const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
  });

  $effect(() => {
    if (!canvas) return;

    const config: ChartConfiguration<'scatter'> = {
      type: 'scatter',
      data: {
        datasets: graph.series.map((series) => ({
          backgroundColor: series.color,
          borderColor: series.color,
          // Chart.js instruments dataset arrays. Copy points out of Svelte's
          // reactive proxy so that third-party mutation stays at the boundary.
          data: series.data.map(({ x, y }) => ({ x, y })),
          hidden: visibleSeries ? !visibleSeries.includes(series.label) : false,
          label: series.label,
          pointRadius: 1.8,
          pointHoverRadius: 4,
          showLine: false,
        })),
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        normalized: true,
        parsing: false,
        interaction: { intersect: false, mode: 'nearest' },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) =>
                items[0]
                  ? new Date(items[0].parsed.x ?? 0).toLocaleString()
                  : '',
              label: (item) =>
                `${item.dataset.label ?? 'Series'}: ${numberFormat.format(item.parsed.y ?? 0)}`,
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
            reverse: graph.lowerIsBetter === false,
            ticks: {
              callback: (value) => numberFormat.format(Number(value)),
            },
            title: { display: true, text: graph.yLabel },
          },
        },
      },
    };

    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  });
</script>

<div class="chart-container">
  <canvas bind:this={canvas} aria-label={`${graph.title} performance chart`}
  ></canvas>
</div>

<style>
  .chart-container {
    height: clamp(18rem, 38vw, 30rem);
    min-width: 0;
    position: relative;
  }
</style>
