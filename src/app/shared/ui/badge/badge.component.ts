import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Semantic status tone. Every status in the system maps onto one of these, so
 * a "ready" lab report and a "paid" invoice look identical without each feature
 * hard-coding colours.
 */
export type StatusTone = 'ready' | 'pending' | 'critical' | 'info' | 'neutral';

const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  ready: 'bg-status-ready-soft text-status-ready-strong ring-status-ready/30',
  pending: 'bg-status-pending-soft text-status-pending-strong ring-status-pending/30',
  critical: 'bg-status-critical-soft text-status-critical-strong ring-status-critical/30',
  info: 'bg-status-info-soft text-status-info-strong ring-status-info/30',
  neutral: 'bg-status-neutral-soft text-status-neutral-strong ring-status-neutral/30',
};

const DOT_CLASSES: Readonly<Record<StatusTone, string>> = {
  ready: 'bg-status-ready',
  pending: 'bg-status-pending',
  critical: 'bg-status-critical',
  info: 'bg-status-info',
  neutral: 'bg-status-neutral',
};

@Component({
  selector: 'hms-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset"
      [class]="toneClass()"
    >
      @if (dot()) {
        <span class="size-1.5 rounded-full" [class]="dotClass()" aria-hidden="true"></span>
      }
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<StatusTone>('neutral');
  readonly dot = input(true);

  protected readonly toneClass = computed(() => TONE_CLASSES[this.tone()]);
  protected readonly dotClass = computed(() => DOT_CLASSES[this.tone()]);
}
