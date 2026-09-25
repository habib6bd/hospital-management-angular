import { ChangeDetectionStrategy, Component, DOCUMENT, PLATFORM_ID, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SeoService } from '../../../core/seo/seo.service';
import { toApiError } from '../../../core/http/api-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { BD_PHONE_PATTERN, normalisePhone } from '../../../shared/validators/hms-validators';
import type { BookingConfirmation } from '../../../shared/models/public.model';
import { PublicSiteService } from '../public-site.service';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { formatDate, formatTime } from '../site-format';

/**
 * Booking slip. Right after booking it reads the confirmation from memory; on
 * a reload (or from "check my booking") it asks for the phone number and looks
 * the booking up, so personal details never need to sit in browser storage.
 */
@Component({
  selector: 'site-booking-confirmation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SiteButtonDirective, ...I18N_PIPES],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      @if (booking(); as b) {
        <div class="no-print text-center">
          <span class="mx-auto flex size-16 items-center justify-center rounded-full bg-status-ready-soft text-status-ready-strong">
            <hms-icon name="check" [size]="32" />
          </span>
          <h1 class="font-display mt-5 text-2xl font-bold tracking-tight text-accent-900 sm:text-3xl dark:text-white">{{ 'confirm.title' | t }}</h1>
          <p class="mt-2 text-surface-fg-muted">{{ 'confirm.lead' | t: { phone: b.phone } }}</p>
        </div>

        <!-- The slip: this is what prints. -->
        <article class="mt-8 overflow-hidden rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10 print:mt-0 print:ring-black/20" aria-labelledby="slip-heading">
          <header class="flex items-center justify-between gap-4 bg-accent-900 px-6 py-4 text-white print:bg-white print:text-black">
            <div>
              <p class="text-xs uppercase tracking-wide text-white/70 print:text-black/60">{{ config.name | loc }}</p>
              <h2 id="slip-heading" class="font-semibold">{{ 'confirm.slip' | t }}</h2>
            </div>
            <div class="text-right">
              <p class="text-xs text-white/70 print:text-black/60">{{ 'confirm.reference' | t }}</p>
              <p class="font-mono text-lg font-bold tracking-wider">{{ b.reference }}</p>
            </div>
          </header>

          <div class="grid grid-cols-2 border-b border-dashed border-surface-border">
            <div class="border-r border-dashed border-surface-border px-6 py-5 text-center">
              <p class="text-xs text-surface-fg-muted">{{ 'confirm.serial' | t }}</p>
              <p class="mt-1 text-4xl font-extrabold text-brand-700 dark:text-brand-300 print:text-black">{{ b.serialNo | num }}</p>
            </div>
            <div class="px-6 py-5 text-center">
              <p class="text-xs text-surface-fg-muted">{{ 'doctor.room' | t }}</p>
              <p class="mt-1 text-4xl font-extrabold text-accent-950 dark:text-white print:text-black">{{ b.room }}</p>
            </div>
          </div>

          <dl class="divide-y divide-surface-border px-6 text-sm">
            <div class="flex justify-between gap-4 py-3">
              <dt class="text-surface-fg-muted">{{ 'confirm.patient' | t }}</dt>
              <dd class="text-right font-semibold text-surface-fg">{{ b.patientName }}</dd>
            </div>
            <div class="flex justify-between gap-4 py-3">
              <dt class="text-surface-fg-muted">{{ 'confirm.doctor' | t }}</dt>
              <dd class="text-right">
                <span class="block font-semibold text-surface-fg">{{ b.doctorName | loc }}</span>
                <span class="block text-xs text-surface-fg-muted">{{ b.specialty | loc }}</span>
              </dd>
            </div>
            <div class="flex justify-between gap-4 py-3">
              <dt class="text-surface-fg-muted">{{ 'book.time.date' | t }}</dt>
              <dd class="text-right font-semibold text-surface-fg">{{ dateLabel() }}</dd>
            </div>
            <div class="flex justify-between gap-4 py-3">
              <dt class="text-surface-fg-muted">{{ 'book.time.slot' | t }}</dt>
              <dd class="text-right font-semibold text-surface-fg">{{ timeLabel() }}</dd>
            </div>
            <div class="flex justify-between gap-4 py-3">
              <dt class="text-surface-fg-muted">{{ 'doctor.fee' | t }}</dt>
              <dd class="text-right font-semibold text-surface-fg">৳{{ b.fee | num }} <span class="font-normal text-surface-fg-muted">· {{ 'confirm.payAt' | t }}</span></dd>
            </div>
          </dl>

          <div class="bg-surface-sunken px-6 py-4 text-sm print:bg-white">
            <p class="font-semibold text-surface-fg">{{ 'confirm.before' | t }}</p>
            <ul class="mt-2 list-disc space-y-1 pl-5 text-surface-fg-muted">
              <li>{{ 'confirm.tip1' | t }}</li>
              <li>{{ 'confirm.tip2' | t }}</li>
              <li>{{ 'confirm.tip3' | t: { hotline: config.hotline } }}</li>
            </ul>
          </div>
        </article>

        <div class="no-print mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" siteBtn (click)="print()">
            <hms-icon name="printer" [size]="18" />
            {{ 'confirm.print' | t }}
          </button>
          <button type="button" siteBtn="outline" (click)="addToCalendar(b)">
            <hms-icon name="calendar" [size]="18" />
            {{ 'confirm.calendar' | t }}
          </button>
          <a routerLink="/book" siteBtn="ghost">{{ 'confirm.another' | t }}</a>
        </div>
      } @else {
        <!-- Lookup: after a reload, or when checking an existing booking. -->
        <div class="rounded-3xl bg-surface-raised shadow-soft p-6 ring-1 ring-slate-900/5 dark:ring-white/10 sm:p-8">
          <span class="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
            <hms-icon name="search" [size]="24" />
          </span>
          <h1 class="font-display mt-4 text-xl font-bold text-accent-950 dark:text-white">{{ 'confirm.lookupTitle' | t }}</h1>
          <p class="mt-1 text-sm text-surface-fg-muted">{{ 'confirm.lookupLead' | t }}</p>
          <form class="mt-6 space-y-4" novalidate (submit)="lookup($event)">
            <div>
              <label for="lookup-ref" class="text-xs font-medium text-surface-fg">{{ 'confirm.reference' | t }}</label>
              <input
                id="lookup-ref"
                type="text"
                autocapitalize="characters"
                class="mt-1.5 h-11 w-full rounded-xl bg-surface px-3.5 font-mono text-sm uppercase text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
                [value]="lookupRef()"
                (input)="lookupRef.set($any($event.target).value)"
              />
            </div>
            <div>
              <label for="lookup-phone" class="text-xs font-medium text-surface-fg">{{ 'book.details.phone' | t }}</label>
              <input
                id="lookup-phone"
                type="tel"
                inputmode="tel"
                placeholder="01XXXXXXXXX"
                class="mt-1.5 h-11 w-full rounded-xl bg-surface px-3.5 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
                [value]="lookupPhone()"
                (input)="lookupPhone.set($any($event.target).value)"
              />
            </div>
            @if (lookupError()) {
              <p class="rounded-xl bg-status-critical-soft px-4 py-3 text-sm text-status-critical-strong" role="alert">{{ lookupError() }}</p>
            }
            <button type="submit" siteBtn class="w-full" [disabled]="looking()">{{ 'confirm.lookupButton' | t }}</button>
          </form>
        </div>
      }
    </div>
  `,
})
export class BookingConfirmationComponent {
  private readonly site = inject(PublicSiteService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly config = SITE_CONFIG;

  /** Route param `:reference`. */
  readonly reference = input.required<string>();

  private readonly lookedUp = signal<BookingConfirmation | null>(null);

  protected readonly booking = computed<BookingConfirmation | null>(() => {
    const found = this.lookedUp();
    if (found !== null) {
      return found;
    }
    const last = this.site.lastBooking();
    return last !== null && last.reference === this.reference() ? last : null;
  });

  protected readonly lookupRef = linkedSignal(() => this.reference());
  protected readonly lookupPhone = signal('');
  protected readonly lookupError = signal<string | null>(null);
  protected readonly looking = signal(false);

  protected readonly dateLabel = computed(() => {
    const b = this.booking();
    return b === null ? '' : formatDate(b.date, this.i18n.lang());
  });

  protected readonly timeLabel = computed(() => {
    const b = this.booking();
    const lang = this.i18n.lang();
    return b === null ? '' : `${formatTime(b.startTime, lang)} – ${formatTime(b.endTime, lang)}`;
  });

  constructor() {
    const seo = inject(SeoService);
    effect(() => seo.set({ title: this.i18n.t('confirm.title') }));
  }

  protected async lookup(event: Event): Promise<void> {
    event.preventDefault();
    const phone = normalisePhone(this.lookupPhone());
    if (!BD_PHONE_PATTERN.test(phone)) {
      this.lookupError.set(this.i18n.t('book.err.phone'));
      return;
    }
    this.looking.set(true);
    this.lookupError.set(null);
    try {
      this.lookedUp.set(await this.site.lookupBooking(this.lookupRef().trim(), phone));
    } catch (caught: unknown) {
      const error = toApiError(caught);
      this.lookupError.set(error.status === 404 ? this.i18n.t('confirm.notFound') : error.message);
    } finally {
      this.looking.set(false);
    }
  }

  protected print(): void {
    if (this.isBrowser) {
      window.print();
    }
  }

  /** A one-event .ics file; every calendar app on every platform opens it. */
  protected addToCalendar(booking: BookingConfirmation): void {
    if (!this.isBrowser) {
      return;
    }
    const stamp = (date: string, time: string): string => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
    const escape = (value: string): string => value.replace(/([,;\\])/g, '\\$1');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CareWell//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${booking.reference}@carewell`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;TZID=Asia/Dhaka:${stamp(booking.date, booking.startTime)}`,
      `DTEND;TZID=Asia/Dhaka:${stamp(booking.date, booking.endTime)}`,
      `SUMMARY:${escape(`Appointment: ${booking.doctorName.en}`)}`,
      `LOCATION:${escape(`${SITE_CONFIG.name.en}, Room ${booking.room}`)}`,
      `DESCRIPTION:${escape(`Ref ${booking.reference}, serial ${booking.serialNo}`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `appointment-${booking.reference}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
