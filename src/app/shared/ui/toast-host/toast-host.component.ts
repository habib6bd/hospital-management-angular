import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, type ToastTone } from '../../../core/services/toast.service';

const TONE_CLASSES: Readonly<Record<ToastTone, string>> = {
  success: 'border-l-status-ready',
  error: 'border-l-status-critical',
  warning: 'border-l-status-pending',
  info: 'border-l-status-info',
};

const TONE_ICON_CLASSES: Readonly<Record<ToastTone, string>> = {
  success: 'text-status-ready',
  error: 'text-status-critical',
  warning: 'text-status-pending',
  info: 'text-status-info',
};

/**
 * Renders the global toast queue. Mounted once in `App`, outside the router
 * outlet, so toasts survive navigation.
 *
 * `aria-live="polite"` on the container announces new toasts without stealing
 * focus — important because errors here can appear mid-task.
 */
@Component({
  selector: 'hms-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-auto sm:right-0 sm:top-0 sm:items-end"
      role="region"
      aria-label="Notifications"
    >
      <div aria-live="polite" aria-atomic="false" class="contents">
        @for (toast of toasts(); track toast.id) {
          <div
            class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border-l-4 bg-surface-raised p-4 shadow-lg ring-1 ring-surface-border"
            [class]="toneClass(toast.tone)"
            role="alert"
          >
            <svg
              class="mt-0.5 size-4 shrink-0"
              [class]="iconClass(toast.tone)"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              @switch (toast.tone) {
                @case ('success') {
                  <path
                    d="m5 13 4 4L19 7"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                }
                @case ('error') {
                  <path
                    d="M12 8v5m0 3.5h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                }
                @default {
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                  <path
                    d="M12 8h.01M11 12h1v4h1"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                }
              }
            </svg>

            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-surface-fg">{{ toast.title }}</p>
              @if (toast.message !== null) {
                <p class="mt-0.5 text-xs text-surface-fg-muted">{{ toast.message }}</p>
              }
            </div>

            <button
              type="button"
              class="-m-1 rounded p-1 text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
              [attr.aria-label]="'Dismiss: ' + toast.title"
              (click)="toastService.dismiss(toast.id)"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected toneClass(tone: ToastTone): string {
    return TONE_CLASSES[tone];
  }

  protected iconClass(tone: ToastTone): string {
    return TONE_ICON_CLASSES[tone];
  }
}
