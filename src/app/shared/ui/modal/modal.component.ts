import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog.
 *
 * Focus is moved into the dialog on open, trapped inside it with Tab/Shift+Tab,
 * and returned to the trigger on close. Without that, a keyboard or screen
 * reader user lands behind the overlay with no way back — which in a clinical
 * workflow means the action silently cannot be completed.
 */
@Component({
  selector: 'hms-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div class="absolute inset-0 bg-black/50" aria-hidden="true" (click)="dismiss()"></div>

      <div
        #panel
        class="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card bg-surface-raised shadow-xl ring-1 ring-surface-border sm:max-w-lg sm:rounded-card"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        (keydown)="onKeydown($event)"
      >
        <header class="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div class="min-w-0">
            <h2 [id]="titleId" class="text-sm font-semibold text-surface-fg">{{ heading() }}</h2>
            @if (description() !== null) {
              <p class="mt-0.5 text-xs text-surface-fg-muted">{{ description() }}</p>
            }
          </div>
          <button
            type="button"
            class="-m-1 rounded p-1 text-surface-fg-muted transition-colors hover:bg-surface-sunken hover:text-surface-fg"
            aria-label="Close dialog"
            (click)="dismiss()"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="hms-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <ng-content />
        </div>

        <footer class="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-3">
          <ng-content select="[modal-footer]" />
        </footer>
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  /** Blocks dismissal while a submit is in flight. */
  readonly busy = input(false);

  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly previouslyFocused =
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null);

  constructor() {
    afterNextRender(() => {
      const focusable = this.focusableElements();
      (focusable[0] ?? this.panel().nativeElement).focus();
    });

    inject(DestroyRef).onDestroy(() => {
      this.previouslyFocused?.focus();
    });
  }

  protected dismiss(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.focusableElements();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): readonly HTMLElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
  }
}
