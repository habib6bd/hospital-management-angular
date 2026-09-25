import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Eyebrow + title + lead paragraph, the opening of every home-page section. */
@Component({
  selector: 'site-section-heading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div [class]="align() === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'">
      @if (eyebrow()) {
        <p
          class="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em]"
          [class]="inverse() ? 'text-brand-300' : 'text-brand-600 dark:text-brand-400'"
        >
          <span class="h-px w-6 bg-current"></span>
          {{ eyebrow() }}
        </p>
      }
      <h2
        [id]="headingId()"
        class="font-display mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
        [class]="inverse() ? 'text-white' : 'text-accent-950 dark:text-white'"
      >
        {{ title() }}
      </h2>
      @if (lead()) {
        <p class="mt-4 text-base leading-relaxed sm:text-lg" [class]="inverse() ? 'text-white/70' : 'text-slate-600 dark:text-surface-fg-muted'">
          {{ lead() }}
        </p>
      }
    </div>
  `,
})
export class SectionHeadingComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly lead = input('');
  readonly align = input<'left' | 'center'>('center');
  readonly headingId = input<string | null>(null);
  /** For dark or photo backgrounds. */
  readonly inverse = input(false);
}
