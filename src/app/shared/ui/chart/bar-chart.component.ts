import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Chart } from 'chart.js';
import { ThemeService } from '../../../core/services/theme.service';

type ChartModule = typeof import('chart.js/auto');

/**
 * Resolves a design token to `rgb()` by painting one pixel. Chart.js derives
 * hover shades with its own colour parser, which does not understand the
 * `oklch()` values our tokens are written in.
 */
function resolveToken(host: HTMLElement, token: string): string {
  const raw = getComputedStyle(host).getPropertyValue(token).trim();
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (context === null || raw === '') {
    return raw;
  }
  context.fillStyle = raw;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Single-series bar chart. The card around it names the series, so there is
 * no legend; values are read from the hover tooltip or the visually hidden
 * table that screen readers get instead of the canvas.
 *
 * Chart.js is imported on first render, so it never enters the initial bundle.
 */
@Component({
  selector: 'hms-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative" [style.height.px]="height()">
      <canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>
    </div>
    <table class="sr-only">
      <caption>{{ ariaLabel() }}</caption>
      <tbody>
        @for (label of labels(); track $index) {
          <tr>
            <th scope="row">{{ label }}</th>
            <td>{{ formatValue()(values()[$index] ?? 0) }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class BarChartComponent {
  readonly labels = input.required<readonly string[]>();
  readonly values = input.required<readonly number[]>();
  /** Series name, shown in the tooltip. */
  readonly seriesLabel = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly horizontal = input(false);
  readonly height = input(220);
  readonly formatValue = input<(value: number) => string>((value) => value.toLocaleString('en-GB'));

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly theme = inject(ThemeService);
  private readonly chartModule = signal<ChartModule | null>(null);
  private chart: Chart | null = null;

  constructor() {
    afterNextRender(() => {
      void import('chart.js/auto').then((module) => this.chartModule.set(module));
    });

    // Rebuilt rather than patched: the data is a handful of bars, and a
    // rebuild picks up theme colours and orientation in one place.
    effect(() => {
      const module = this.chartModule();
      if (module === null) {
        return;
      }
      this.theme.resolved();
      const labels = this.labels();
      const values = this.values();
      untracked(() => this.render(module, labels, values));
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private render(module: ChartModule, labels: readonly string[], values: readonly number[]): void {
    const canvas = this.canvas().nativeElement;
    const dark = this.theme.resolved() === 'dark';
    const bar = resolveToken(canvas, dark ? '--color-brand-400' : '--color-brand-500');
    const grid = resolveToken(canvas, '--color-surface-border');
    const ink = resolveToken(canvas, '--color-surface-fg-muted');
    const horizontal = this.horizontal();
    const format = this.formatValue();

    this.chart?.destroy();
    this.chart = new module.default(canvas, {
      type: 'bar',
      data: {
        labels: [...labels],
        datasets: [
          {
            label: this.seriesLabel(),
            data: [...values],
            backgroundColor: bar,
            hoverBackgroundColor: bar,
            borderRadius: 4,
            // Round only the data end; the baseline end stays square.
            borderSkipped: 'start',
            maxBarThickness: 28,
          },
        ],
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        maintainAspectRatio: false,
        // Static: a resize (sidebar collapse, rotation) would otherwise replay the grow-in.
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: { label: (item) => `${item.dataset.label}: ${format(item.parsed[horizontal ? 'x' : 'y'] ?? 0)}` },
          },
        },
        scales: {
          [horizontal ? 'y' : 'x']: {
            grid: { display: false },
            border: { color: grid },
            ticks: { color: ink },
          },
          [horizontal ? 'x' : 'y']: {
            beginAtZero: true,
            grid: { color: grid },
            border: { display: false },
            ticks: { color: ink, precision: 0, callback: (value) => format(Number(value)) },
          },
        },
      },
    });
  }
}
