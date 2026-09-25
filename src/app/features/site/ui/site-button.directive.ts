import { Directive, computed, input } from '@angular/core';

export type SiteButtonVariant = 'primary' | 'outline' | 'ghost' | 'white' | 'emergency' | 'glass';
export type SiteButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Readonly<Record<SiteButtonVariant, string>> = {
  primary:
    'bg-brand-600 text-white shadow-[0_8px_20px_-6px] shadow-brand-600/50 hover:bg-brand-700 hover:shadow-brand-700/50 active:bg-brand-800',
  outline:
    'bg-white text-accent-900 ring-1 ring-inset ring-slate-200 hover:ring-brand-300 hover:text-brand-700 dark:bg-transparent dark:text-white dark:ring-white/20 dark:hover:ring-brand-400',
  ghost: 'text-surface-fg hover:bg-surface-sunken',
  white: 'bg-white text-brand-700 shadow-sm hover:bg-brand-50',
  emergency: 'bg-emergency text-white shadow-[0_8px_20px_-6px] shadow-emergency/50 hover:bg-emergency-strong',
  glass: 'bg-white/10 text-white ring-1 ring-inset ring-white/30 backdrop-blur hover:bg-white/20',
};

const SIZES: Readonly<Record<SiteButtonSize, string>> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-[15px] gap-2',
};

/**
 * Button styling for links and buttons on the public site.
 *
 * `hms-button` wraps a <button>, which cannot carry a `routerLink` or `href`;
 * most calls to action on a marketing site are navigation, so this is a
 * directive applied to the native element instead: `<a siteBtn="outline">`.
 */
@Directive({
  selector: '[siteBtn]',
  host: { '[class]': 'classes()' },
})
export class SiteButtonDirective {
  readonly variant = input<SiteButtonVariant, SiteButtonVariant | ''>('primary', {
    alias: 'siteBtn',
    // A bare `siteBtn` attribute arrives as '' — treat it as the default.
    transform: (value) => (value === '' ? 'primary' : value),
  });
  readonly size = input<SiteButtonSize>('md');

  protected readonly classes = computed(
    () =>
      `inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-all duration-200 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
