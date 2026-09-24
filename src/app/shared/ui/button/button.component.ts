import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/50 shadow-sm',
  secondary:
    'bg-surface-raised text-surface-fg ring-1 ring-inset ring-surface-border hover:bg-surface-sunken',
  ghost: 'text-surface-fg-muted hover:bg-surface-sunken hover:text-surface-fg',
  danger:
    'bg-status-critical text-white hover:brightness-95 active:brightness-90 disabled:opacity-50 shadow-sm',
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

@Component({
  selector: 'hms-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
      class="inline-flex items-center justify-center rounded-control font-medium transition-colors
             disabled:cursor-not-allowed disabled:opacity-60"
      [class]="classes()"
      (click)="pressed.emit($event)"
    >
      @if (loading()) {
        <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
      }
      <ng-content />
    </button>
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);
  readonly ariaLabel = input<string | null>(null);

  readonly pressed = output<MouseEvent>();

  protected readonly classes = computed(
    () =>
      `${VARIANTS[this.variant()]} ${SIZES[this.size()]} ${this.fullWidth() ? 'w-full' : ''}`.trim(),
  );
}
