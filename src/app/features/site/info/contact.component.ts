import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { FormField, form, schema, submit, validate } from '@angular/forms/signals';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { fieldError, toApiError, type ApiError } from '../../../core/http/api-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { BD_PHONE_PATTERN, normalisePhone } from '../../../shared/validators/hms-validators';
import { PublicSiteService } from '../public-site.service';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SiteButtonDirective } from '../ui/site-button.directive';

interface ContactModel {
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
}

const MESSAGE_MAX_LENGTH = 1000;

const INPUT_CLASS =
  'h-11 w-full rounded-xl bg-surface px-3.5 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'site-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, IconComponent, FormFieldComponent, PageHeroComponent, SiteButtonDirective, ...I18N_PIPES],
  template: `
    <site-page-hero [title]="'contact.title' | t" [lead]="'contact.lead' | t" [crumbs]="[{ label: ('nav.contact' | t) }]" image="/images/about/reception.webp" />

    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <a [href]="'tel:' + config.emergency" class="flex h-full flex-col rounded-card bg-emergency p-5 text-white">
            <hms-icon name="siren" [size]="24" />
            <span class="mt-3 text-sm text-white/85">{{ 'top.emergency' | t }} · {{ 'contact.always' | t }}</span>
            <span class="text-lg font-bold">{{ config.emergency | num }}</span>
          </a>
        </li>
        <li>
          <a [href]="'tel:' + config.hotline" class="flex h-full flex-col rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10 hover:ring-brand-300">
            <hms-icon name="phone" [size]="24" class="text-brand-600" />
            <span class="mt-3 text-sm text-surface-fg-muted">{{ 'top.hotline' | t }}</span>
            <span class="text-lg font-bold text-accent-950 dark:text-white">{{ config.hotline | num }}</span>
          </a>
        </li>
        <li>
          <a [href]="'mailto:' + config.email" class="flex h-full flex-col rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10 hover:ring-brand-300">
            <hms-icon name="mail" [size]="24" class="text-brand-600" />
            <span class="mt-3 text-sm text-surface-fg-muted">{{ 'contact.email' | t }}</span>
            <span class="break-all font-bold text-accent-950 dark:text-white">{{ config.email }}</span>
          </a>
        </li>
        <li>
          <div class="flex h-full flex-col rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10">
            <hms-icon name="clock" [size]="24" class="text-brand-600" />
            <span class="mt-3 text-sm font-semibold text-accent-950 dark:text-white">{{ config.opdHours | loc }}</span>
            <span class="mt-1 text-sm text-surface-fg-muted">{{ config.visitingHours | loc }}</span>
          </div>
        </li>
      </ul>

      <div class="mt-10 grid gap-8 lg:grid-cols-2">
        <section class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10 sm:p-8" aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'contact.formTitle' | t }}</h2>
          <p class="mt-1 text-sm text-surface-fg-muted">{{ 'contact.formLead' | t }}</p>

          @if (sent()) {
            <div class="mt-6 flex gap-3 rounded-xl bg-status-ready-soft p-4 text-sm text-status-ready-strong" role="status">
              <hms-icon name="check-circle" [size]="20" class="shrink-0" />
              <div>
                <p class="font-semibold">{{ 'contact.sentTitle' | t }}</p>
                <p class="mt-0.5">{{ 'contact.sentText' | t }}</p>
              </div>
            </div>
          } @else {
            <form class="mt-6 grid gap-4 sm:grid-cols-2" novalidate (submit)="onSubmit($event)">
              <hms-form-field [label]="'contact.name' | t" controlId="contact-name" [field]="contactForm.name" [required]="true" [serverError]="serverError('name')">
                <input id="contact-name" type="text" autocomplete="name" [class]="inputClass" [formField]="contactForm.name" />
              </hms-form-field>
              <hms-form-field [label]="'book.details.phone' | t" controlId="contact-phone" [field]="contactForm.phone" [required]="true" [serverError]="serverError('phone')">
                <input id="contact-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" [class]="inputClass" [formField]="contactForm.phone" />
              </hms-form-field>
              <hms-form-field [label]="'contact.emailOptional' | t" controlId="contact-email" [field]="contactForm.email">
                <input id="contact-email" type="email" autocomplete="email" [class]="inputClass" [formField]="contactForm.email" />
              </hms-form-field>
              <hms-form-field [label]="'contact.subject' | t" controlId="contact-subject" [field]="contactForm.subject">
                <select id="contact-subject" [class]="inputClass" [formField]="contactForm.subject">
                  <option value="general">{{ 'contact.subjectGeneral' | t }}</option>
                  <option value="appointment">{{ 'contact.subjectAppointment' | t }}</option>
                  <option value="package">{{ 'contact.subjectPackage' | t }}</option>
                  <option value="feedback">{{ 'contact.subjectFeedback' | t }}</option>
                </select>
              </hms-form-field>
              <div class="sm:col-span-2">
                <hms-form-field [label]="'contact.message' | t" controlId="contact-message" [field]="contactForm.message" [required]="true" [serverError]="serverError('message')">
                  <textarea id="contact-message" rows="5" class="w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500" [formField]="contactForm.message"></textarea>
                </hms-form-field>
              </div>
              @if (generalError()) {
                <p class="rounded-xl bg-status-critical-soft px-4 py-3 text-sm text-status-critical-strong sm:col-span-2" role="alert">{{ generalError() }}</p>
              }
              <div class="sm:col-span-2">
                <button type="submit" siteBtn [disabled]="sending()">
                  <hms-icon name="send" [size]="16" />
                  {{ 'contact.send' | t }}
                </button>
              </div>
            </form>
          }
        </section>

        <section class="flex flex-col overflow-hidden rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10" aria-labelledby="visit-heading">
          <div class="p-6 sm:p-8">
            <h2 id="visit-heading" class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'contact.visit' | t }}</h2>
            <p class="mt-2 flex gap-2 text-surface-fg">
              <hms-icon name="map-pin" [size]="20" class="mt-0.5 shrink-0 text-brand-600" />
              {{ config.address | loc }}
            </p>
            <a [href]="config.mapLink" target="_blank" rel="noopener noreferrer" class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              {{ 'contact.directions' | t }}
              <hms-icon name="arrow-right" [size]="16" />
            </a>
          </div>
          <iframe
            class="min-h-80 w-full flex-1 border-0"
            [src]="mapUrl"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            [title]="'contact.mapTitle' | t"
          ></iframe>
        </section>
      </div>
    </div>
  `,
})
export class ContactComponent {
  private readonly site = inject(PublicSiteService);
  private readonly i18n = inject(I18nService);

  protected readonly config = SITE_CONFIG;
  protected readonly inputClass = INPUT_CLASS;
  // The embed URL is a constant from our own config, not user input.
  protected readonly mapUrl = inject(DomSanitizer).bypassSecurityTrustResourceUrl(SITE_CONFIG.mapEmbedUrl);

  /** `?subject=package` from the health-package cards. */
  readonly subject = input<string | undefined>(undefined);

  private readonly model = signal<ContactModel>({ name: '', phone: '', email: '', subject: 'general', message: '' });
  protected readonly contactForm = form(
    this.model,
    schema<ContactModel>((path) => {
      validate(path.name, ({ value }) =>
        value().trim() === '' ? { kind: 'required', message: this.i18n.t('book.err.name') } : null,
      );
      validate(path.phone, ({ value }) =>
        BD_PHONE_PATTERN.test(normalisePhone(value())) ? null : { kind: 'phone', message: this.i18n.t('book.err.phone') },
      );
      validate(path.message, ({ value }) => {
        const length = value().trim().length;
        if (length < 10) {
          return { kind: 'minLength', message: this.i18n.t('contact.errMessage') };
        }
        return length > MESSAGE_MAX_LENGTH
          ? { kind: 'maxLength', message: this.i18n.t('common.tooLong', { n: MESSAGE_MAX_LENGTH }) }
          : null;
      });
    }),
  );

  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly generalError = signal<string | null>(null);
  private readonly apiError = signal<ApiError | null>(null);

  constructor() {
    const seo = inject(SeoService);
    effect(() => seo.set({ title: this.i18n.t('contact.title'), description: this.i18n.t('contact.lead') }));
    effect(() => {
      const subject = this.subject();
      if (subject === 'package' || subject === 'appointment' || subject === 'feedback') {
        this.model.update((current) => ({ ...current, subject }));
      }
    });
  }

  protected serverError(field: string): string | null {
    return fieldError(this.apiError(), field);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.generalError.set(null);
    this.apiError.set(null);
    await submit(this.contactForm, async () => {
      this.sending.set(true);
      try {
        const value = this.model();
        await this.site.sendContact({ ...value, phone: normalisePhone(value.phone) });
        this.sent.set(true);
      } catch (caught: unknown) {
        const error = toApiError(caught);
        this.apiError.set(error);
        if (Object.keys(error.fieldErrors).length === 0) {
          this.generalError.set(error.message);
        }
      } finally {
        this.sending.set(false);
      }
      return null;
    });
  }
}
