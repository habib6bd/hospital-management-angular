import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/ui/icon/icon.component';

/** EN / বাং segmented switch. Each option is labelled in its own language. */
@Component({
  selector: 'site-lang-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div
      role="group"
      aria-label="Language / ভাষা"
      class="inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold"
      [class]="tone() === 'dark' ? 'bg-white/10' : 'bg-surface-sunken ring-1 ring-surface-border'"
    >
      <hms-icon name="globe" [size]="14" class="mx-1.5 opacity-70" />
      <button
        type="button"
        lang="en"
        class="rounded-full px-2.5 py-1 transition-colors"
        [class]="optionClass('en')"
        [attr.aria-pressed]="i18n.lang() === 'en'"
        (click)="i18n.set('en')"
      >
        EN
      </button>
      <button
        type="button"
        lang="bn"
        class="rounded-full px-2.5 py-1 transition-colors"
        [class]="optionClass('bn')"
        [attr.aria-pressed]="i18n.lang() === 'bn'"
        (click)="i18n.set('bn')"
      >
        বাংলা
      </button>
    </div>
  `,
})
export class LangToggleComponent {
  protected readonly i18n = inject(I18nService);

  /** `dark` for the navy utility bar, `light` for surfaces. */
  readonly tone = input<'dark' | 'light'>('light');

  protected optionClass(lang: 'en' | 'bn'): string {
    const active = this.i18n.lang() === lang;
    if (this.tone() === 'dark') {
      return active ? 'bg-white text-accent-900' : 'text-white/80 hover:text-white';
    }
    return active ? 'bg-brand-600 text-white' : 'text-surface-fg-muted hover:text-surface-fg';
  }
}
