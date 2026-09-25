import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

const GRADIENTS = [
  'from-brand-500 to-brand-700',
  'from-accent-600 to-accent-800',
  'from-brand-600 to-accent-700',
  'from-brand-400 to-accent-600',
];

const RATIOS = {
  square: 'aspect-square',
  card: 'aspect-[5/4]',
  portrait: 'aspect-[4/5]',
} as const;

/**
 * Doctor portrait, falling back to initials on a gradient when no photo has
 * been uploaded. The gradient is picked from the id so it is stable per doctor.
 */
@Component({
  selector: 'site-doctor-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage],
  host: { class: 'block overflow-hidden' },
  template: `
    @if (photoUrl(); as src) {
      <img
        [ngSrc]="src"
        [width]="size()"
        [height]="size()"
        [priority]="priority()"
        [alt]="name()"
        class="w-full rounded-[inherit] object-cover object-top"
        [class]="ratioClass()"
      />
    } @else {
      <div
        class="flex w-full items-center justify-center rounded-[inherit] bg-linear-to-br text-white"
        [class]="ratioClass() + ' ' + gradient()"
        role="img"
        [attr.aria-label]="name()"
      >
        <span class="font-bold tracking-wide" [style.font-size.px]="Math.min(size(), 160) * 0.3">{{ initials() }}</span>
      </div>
    }
  `,
})
export class DoctorAvatarComponent {
  readonly id = input.required<number>();
  readonly name = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly size = input(96);
  readonly ratio = input<keyof typeof RATIOS>('square');
  readonly priority = input(false);

  protected readonly Math = Math;
  protected readonly ratioClass = computed(() => RATIOS[this.ratio()]);
  protected readonly gradient = computed(() => GRADIENTS[this.id() % GRADIENTS.length]!);

  protected readonly initials = computed(() =>
    this.name()
      .replace(/^(Dr\.?|ডা\.?)\s*/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
  );
}
