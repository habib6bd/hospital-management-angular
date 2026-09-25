import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  numberAttribute,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, schema, submit, validate } from '@angular/forms/signals';
import { SITE_CONFIG } from '../../../core/config/site-config';
import { I18N_PIPES } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { TranslationKey } from '../../../core/i18n/dictionaries/en';
import { SeoService } from '../../../core/seo/seo.service';
import { fieldError, toApiError, type ApiError } from '../../../core/http/api-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { BD_PHONE_PATTERN, normalisePhone } from '../../../shared/validators/hms-validators';
import type { Gender, PublicDoctor, PublicSlot } from '../../../shared/models/public.model';
import { PublicSiteService } from '../public-site.service';
import { DoctorAvatarComponent } from '../ui/doctor-avatar.component';
import { PageHeroComponent } from '../ui/page-hero.component';
import { SiteButtonDirective } from '../ui/site-button.directive';
import { dayOfMonth, formatDate, formatTime, monthShort, parseIsoDate, toIsoDate, weekdayShort } from '../site-format';

/** Matches the server's booking window. */
const BOOKING_WINDOW_DAYS = 14;
const REASON_MAX_LENGTH = 300;
/** Slots before this hour are grouped as "morning". */
const AFTERNOON_FROM = 12;

type Step = 1 | 2 | 3 | 4;

interface PatientDetails {
  name: string;
  phone: string;
  age: string;
  gender: Gender | '';
  reason: string;
}

const STEPS: readonly { step: Step; label: TranslationKey }[] = [
  { step: 1, label: 'book.step.doctor' },
  { step: 2, label: 'book.step.time' },
  { step: 3, label: 'book.step.details' },
  { step: 4, label: 'book.step.confirm' },
];

const INPUT_CLASS =
  'h-11 w-full rounded-xl bg-surface px-3.5 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500';

/**
 * Four-step guest booking: doctor → date & slot → patient details → confirm.
 *
 * `?doctor=`, `?department=` and `?date=` pre-fill the wizard, so "Book with
 * this doctor" on a profile page lands straight on the time step.
 */
@Component({
  selector: 'site-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    IconComponent,
    SkeletonComponent,
    EmptyStateComponent,
    FormFieldComponent,
    DoctorAvatarComponent,
    PageHeroComponent,
    SiteButtonDirective,
    ...I18N_PIPES,
  ],
  template: `
    <site-page-hero
      [title]="'book.title' | t"
      [lead]="'book.lead' | t"
      [crumbs]="[{ label: ('cta.bookAppointment' | t) }]"
      image="/images/services/health-checkup.webp"
    />

    <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <!-- Progress -->
      <nav [attr.aria-label]="'book.progress' | t" class="mb-8">
        <ol class="grid grid-cols-4 gap-2">
          @for (item of steps; track item.step) {
            <li>
              <button
                type="button"
                class="group flex w-full flex-col gap-2 text-left disabled:cursor-default"
                [disabled]="!canVisit(item.step)"
                [attr.aria-current]="step() === item.step ? 'step' : null"
                (click)="goTo(item.step)"
              >
                <span
                  class="h-1.5 w-full rounded-full transition-colors"
                  [class]="item.step <= step() ? 'bg-brand-600' : 'bg-surface-border'"
                ></span>
                <span class="flex items-center gap-2 text-xs font-semibold sm:text-sm" [class]="item.step === step() ? 'text-brand-700 dark:text-brand-300' : 'text-surface-fg-muted'">
                  <span
                    class="hidden size-6 items-center justify-center rounded-full text-[11px] sm:flex"
                    [class]="item.step < step() ? 'bg-brand-600 text-white' : item.step === step() ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-600 dark:bg-brand-950 dark:text-brand-300' : 'bg-surface-sunken'"
                  >
                    @if (item.step < step()) {
                      <hms-icon name="check" [size]="14" />
                    } @else {
                      {{ item.step | num }}
                    }
                  </span>
                  <span class="truncate">{{ item.label | t }}</span>
                </span>
              </button>
            </li>
          }
        </ol>
      </nav>

      <div class="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section #panel tabindex="-1" class="min-w-0 rounded-3xl bg-surface-raised shadow-soft p-5 ring-1 ring-slate-900/5 dark:ring-white/10 focus:outline-none sm:p-8" aria-live="polite">
          @switch (step()) {
            <!-- ======================================== step 1: doctor -->
            @case (1) {
              <h2 class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'book.doctor.title' | t }}</h2>
              <p class="mt-1 text-sm text-surface-fg-muted">{{ 'book.doctor.lead' | t }}</p>

              <div class="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
                <button type="button" [class]="chipClass(departmentSlug() === '')" (click)="departmentSlug.set('')">
                  {{ 'doctors.allDepartments' | t }}
                </button>
                @for (item of site.departments(); track item.slug) {
                  <button type="button" [class]="chipClass(departmentSlug() === item.slug)" [attr.aria-pressed]="departmentSlug() === item.slug" (click)="departmentSlug.set(item.slug)">
                    {{ item.name | loc }}
                  </button>
                }
              </div>

              <div class="relative mt-4">
                <label for="book-doctor-search" class="sr-only-focusable">{{ 'doctors.searchLabel' | t }}</label>
                <hms-icon name="search" [size]="18" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-fg-muted" />
                <input
                  id="book-doctor-search"
                  type="search"
                  autocomplete="off"
                  [class]="inputClass + ' pl-10'"
                  [placeholder]="'doctors.searchPlaceholder' | t"
                  [value]="doctorSearch()"
                  (input)="doctorSearch.set($any($event.target).value)"
                />
              </div>

              @if (doctorList.value(); as page) {
                <ul class="mt-5 space-y-3" role="list">
                  @for (doctor of filteredDoctors(); track doctor.id) {
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-4 rounded-2xl p-3 text-left ring-1 transition sm:p-4"
                        [class]="doctorId() === doctor.id ? 'bg-brand-50 ring-2 ring-brand-600 dark:bg-brand-950' : 'ring-surface-border hover:bg-surface-sunken hover:ring-brand-200'"
                        [attr.aria-pressed]="doctorId() === doctor.id"
                        (click)="chooseDoctor(doctor)"
                      >
                        <site-doctor-avatar class="w-14 shrink-0 rounded-xl" [id]="doctor.id" [name]="doctor.name | loc" [size]="56" />
                        <span class="min-w-0 flex-1">
                          <span class="block font-semibold text-accent-950 dark:text-white">{{ doctor.name | loc }}</span>
                          <span class="block text-sm text-brand-700 dark:text-brand-400">{{ doctor.specialty | loc }}</span>
                          <span class="mt-0.5 block truncate text-xs text-surface-fg-muted">{{ chamberDays(doctor) }}</span>
                        </span>
                        <span class="shrink-0 text-right">
                          <span class="block text-sm font-bold text-accent-950 dark:text-white">৳{{ doctor.fee | num }}</span>
                          <span class="block text-xs text-surface-fg-muted">{{ 'doctor.fee' | t }}</span>
                        </span>
                      </button>
                    </li>
                  } @empty {
                    <li><hms-empty-state [title]="'doctors.emptyTitle' | t" [description]="'doctors.emptyText' | t" /></li>
                  }
                </ul>
                <p class="sr-only-focusable">{{ 'doctors.count' | t: { n: page.total } }}</p>
              } @else {
                <div class="mt-5"><hms-skeleton [lines]="5" [height]="56" /></div>
              }
            }

            <!-- ================================== step 2: date & slot -->
            @case (2) {
              <h2 class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'book.time.title' | t }}</h2>
              <p class="mt-1 text-sm text-surface-fg-muted">{{ 'book.time.lead' | t }}</p>

              <h3 class="mt-6 text-sm font-semibold text-surface-fg" id="date-label">{{ 'book.time.date' | t }}</h3>
              <div class="no-scrollbar -mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0" role="radiogroup" aria-labelledby="date-label">
                @for (day of dates(); track day.iso) {
                  <button
                    type="button"
                    role="radio"
                    class="flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl py-3 ring-1 transition disabled:cursor-not-allowed disabled:opacity-40"
                    [class]="date() === day.iso ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface-raised text-surface-fg ring-surface-border enabled:hover:ring-brand-300'"
                    [disabled]="!day.available"
                    [attr.aria-checked]="date() === day.iso"
                    [attr.aria-label]="day.full"
                    (click)="chooseDate(day.iso)"
                  >
                    <span class="text-[11px] font-medium uppercase opacity-80">{{ day.weekday }}</span>
                    <span class="text-xl font-bold leading-tight">{{ day.day }}</span>
                    <span class="text-[11px] opacity-80">{{ day.month }}</span>
                  </button>
                }
              </div>

              @if (date() !== '') {
                <h3 class="mt-8 text-sm font-semibold text-surface-fg" id="slot-label">{{ 'book.time.slot' | t }}</h3>
                @if (slotError()) {
                  <p class="mt-3 rounded-xl bg-status-critical-soft px-4 py-3 text-sm text-status-critical-strong" role="alert">{{ slotError() }}</p>
                }
                @if (slots.value(); as list) {
                  @if (list.length === 0) {
                    <p class="mt-3 text-sm text-surface-fg-muted">{{ 'book.time.noSlots' | t }}</p>
                  } @else if (availableCount() === 0) {
                    <p class="mt-3 text-sm text-surface-fg-muted">{{ 'book.time.full' | t }}</p>
                  }
                  @for (group of slotGroups(); track group.label) {
                    @if (group.slots.length > 0) {
                      <p class="mt-5 text-xs font-semibold uppercase tracking-wide text-surface-fg-muted">{{ group.label | t }}</p>
                      <div class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5" role="radiogroup" aria-labelledby="slot-label">
                        @for (slot of group.slots; track slot.startTime) {
                          <button
                            type="button"
                            role="radio"
                            class="rounded-xl py-2.5 text-sm font-semibold ring-1 transition disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-surface-fg-muted/50 disabled:line-through disabled:ring-transparent"
                            [class]="startTime() === slot.startTime ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface-raised text-surface-fg ring-surface-border enabled:hover:ring-brand-400'"
                            [disabled]="!slot.isAvailable"
                            [attr.aria-checked]="startTime() === slot.startTime"
                            (click)="startTime.set(slot.startTime); slotError.set(null)"
                          >
                            {{ time(slot.startTime) }}
                          </button>
                        }
                      </div>
                    }
                  }
                } @else {
                  <div class="mt-3"><hms-skeleton [lines]="3" [height]="40" /></div>
                }
              }

              <div class="mt-8 flex justify-between gap-3 border-t border-surface-border pt-6">
                <button type="button" siteBtn="ghost" (click)="goTo(1)">{{ 'common.back' | t }}</button>
                <button type="button" siteBtn [disabled]="startTime() === ''" (click)="goTo(3)">
                  {{ 'common.continue' | t }}
                  <hms-icon name="arrow-right" [size]="16" />
                </button>
              </div>
            }

            <!-- ==================================== step 3: details -->
            @case (3) {
              <h2 class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'book.details.title' | t }}</h2>
              <p class="mt-1 text-sm text-surface-fg-muted">{{ 'book.details.lead' | t }}</p>

              <form class="mt-6 grid gap-5 sm:grid-cols-2" novalidate (submit)="toReview($event)">
                <div class="sm:col-span-2">
                  <hms-form-field [label]="'book.details.name' | t" controlId="book-name" [field]="details.name" [required]="true" [serverError]="serverError('name')">
                    <input id="book-name" type="text" autocomplete="name" [class]="inputClass" [formField]="details.name" />
                  </hms-form-field>
                </div>
                <hms-form-field [label]="'book.details.phone' | t" controlId="book-phone" [field]="details.phone" [required]="true" [hint]="'book.details.phoneHint' | t" [serverError]="serverError('phone')">
                  <input id="book-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" [class]="inputClass" [formField]="details.phone" />
                </hms-form-field>
                <hms-form-field [label]="'book.details.age' | t" controlId="book-age" [field]="details.age" [required]="true" [serverError]="serverError('age')">
                  <input id="book-age" type="text" inputmode="numeric" [class]="inputClass" [formField]="details.age" />
                </hms-form-field>

                <fieldset class="sm:col-span-2">
                  <legend class="text-xs font-medium text-surface-fg">
                    {{ 'book.details.gender' | t }} <span class="text-status-critical" aria-hidden="true">*</span>
                  </legend>
                  <div class="mt-1.5 grid max-w-xs grid-cols-2 gap-2">
                    @for (option of genders; track option.value) {
                      <button
                        type="button"
                        class="h-11 rounded-xl text-sm font-semibold ring-1 transition"
                        [class]="model().gender === option.value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-surface text-surface-fg ring-surface-border hover:ring-brand-300'"
                        [attr.aria-pressed]="model().gender === option.value"
                        (click)="setGender(option.value)"
                      >
                        {{ option.label | t }}
                      </button>
                    }
                  </div>
                  @if (genderError(); as message) {
                    <p class="mt-1.5 text-xs text-status-critical-strong" role="alert">{{ message }}</p>
                  }
                </fieldset>

                <div class="sm:col-span-2">
                  <hms-form-field [label]="'book.details.reason' | t" controlId="book-reason" [field]="details.reason" [hint]="'book.details.reasonHint' | t">
                    <textarea id="book-reason" rows="3" class="w-full rounded-xl bg-surface px-3.5 py-2.5 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500" [formField]="details.reason"></textarea>
                  </hms-form-field>
                </div>

                <div class="flex justify-between gap-3 border-t border-surface-border pt-6 sm:col-span-2">
                  <button type="button" siteBtn="ghost" (click)="goTo(2)">{{ 'common.back' | t }}</button>
                  <button type="submit" siteBtn>
                    {{ 'book.details.review' | t }}
                    <hms-icon name="arrow-right" [size]="16" />
                  </button>
                </div>
              </form>
            }

            <!-- ==================================== step 4: confirm -->
            @case (4) {
              <h2 class="font-display text-xl font-bold text-accent-950 dark:text-white">{{ 'book.confirm.title' | t }}</h2>
              <p class="mt-1 text-sm text-surface-fg-muted">{{ 'book.confirm.lead' | t }}</p>

              <dl class="mt-6 divide-y divide-surface-border rounded-2xl ring-1 ring-slate-900/5 dark:ring-white/10">
                <div class="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt class="text-surface-fg-muted">{{ 'book.details.name' | t }}</dt>
                  <dd class="text-right font-semibold text-surface-fg">{{ model().name }}</dd>
                </div>
                <div class="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt class="text-surface-fg-muted">{{ 'book.details.phone' | t }}</dt>
                  <dd class="text-right font-semibold text-surface-fg">{{ model().phone | num }}</dd>
                </div>
                <div class="flex justify-between gap-4 px-4 py-3 text-sm">
                  <dt class="text-surface-fg-muted">{{ 'book.details.age' | t }} · {{ 'book.details.gender' | t }}</dt>
                  <dd class="text-right font-semibold text-surface-fg">
                    {{ model().age | num }} · {{ (model().gender === 'female' ? 'doctors.female' : 'doctors.male') | t }}
                  </dd>
                </div>
                @if (model().reason.trim()) {
                  <div class="flex justify-between gap-4 px-4 py-3 text-sm">
                    <dt class="text-surface-fg-muted">{{ 'book.details.reason' | t }}</dt>
                    <dd class="text-right text-surface-fg">{{ model().reason }}</dd>
                  </div>
                }
              </dl>

              <p class="mt-5 flex gap-2.5 rounded-xl bg-status-info-soft px-4 py-3 text-sm text-status-info-strong">
                <hms-icon name="info" [size]="18" class="mt-0.5 shrink-0" />
                {{ 'book.confirm.note' | t }}
              </p>

              @if (submitError()) {
                <p class="mt-4 rounded-xl bg-status-critical-soft px-4 py-3 text-sm text-status-critical-strong" role="alert">{{ submitError() }}</p>
              }

              <div class="mt-8 flex justify-between gap-3 border-t border-surface-border pt-6">
                <button type="button" siteBtn="ghost" [disabled]="submitting()" (click)="goTo(3)">{{ 'common.back' | t }}</button>
                <button type="button" siteBtn size="lg" [disabled]="submitting()" [attr.aria-busy]="submitting()" (click)="confirm()">
                  @if (submitting()) {
                    <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                    </svg>
                  } @else {
                    <hms-icon name="check" [size]="18" />
                  }
                  {{ 'book.confirm.button' | t }}
                </button>
              </div>
            }
          }
        </section>

        <!-- Summary -->
        <aside class="order-first lg:order-none">
          <div class="sticky top-28 rounded-3xl bg-surface-raised shadow-soft ring-1 ring-slate-900/5 dark:ring-white/10">
            <h2 class="border-b border-surface-border px-5 py-4 text-sm font-semibold text-accent-950 dark:text-white">
              {{ 'book.summary' | t }}
            </h2>
            @if (doctor(); as d) {
              <div class="flex items-center gap-3 px-5 py-4">
                <site-doctor-avatar class="w-12 shrink-0 rounded-xl" [id]="d.id" [name]="d.name | loc" [size]="48" />
                <div class="min-w-0">
                  <p class="truncate font-semibold text-accent-950 dark:text-white">{{ d.name | loc }}</p>
                  <p class="truncate text-sm text-brand-700 dark:text-brand-400">{{ d.specialty | loc }}</p>
                </div>
                @if (step() > 1) {
                  <button type="button" class="ml-auto shrink-0 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400" (click)="goTo(1)">
                    {{ 'common.change' | t }}
                  </button>
                }
              </div>
              <dl class="space-y-2.5 border-t border-surface-border px-5 py-4 text-sm">
                <div class="flex justify-between gap-4">
                  <dt class="text-surface-fg-muted">{{ 'book.time.date' | t }}</dt>
                  <dd class="font-semibold text-surface-fg">{{ date() ? longDate(date()) : '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-surface-fg-muted">{{ 'book.time.slot' | t }}</dt>
                  <dd class="font-semibold text-surface-fg">{{ startTime() ? time(startTime()) : '—' }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-surface-fg-muted">{{ 'doctor.room' | t }}</dt>
                  <dd class="font-semibold text-surface-fg">{{ d.room }}</dd>
                </div>
                <div class="flex justify-between gap-4 border-t border-dashed border-surface-border pt-2.5">
                  <dt class="text-surface-fg-muted">{{ 'doctor.fee' | t }}</dt>
                  <dd class="text-base font-bold text-accent-950 dark:text-white">৳{{ d.fee | num }}</dd>
                </div>
              </dl>
              <p class="border-t border-surface-border px-5 py-3 text-xs text-surface-fg-muted">{{ 'book.payAtCounter' | t }}</p>
            } @else {
              <p class="px-5 py-6 text-sm text-surface-fg-muted">{{ 'book.summaryEmpty' | t }}</p>
            }
          </div>

          <a [href]="'tel:' + config.hotline" class="mt-4 hidden items-center gap-3 rounded-card p-4 text-sm text-surface-fg-muted ring-1 ring-slate-900/5 dark:ring-white/10 hover:bg-surface-sunken lg:flex">
            <hms-icon name="phone" [size]="18" class="text-brand-600" />
            <span>{{ 'book.helpPhone' | t }} <strong class="text-surface-fg">{{ config.hotline | num }}</strong></span>
          </a>
        </aside>
      </div>
    </div>
  `,
})
export class BookingComponent {
  protected readonly site = inject(PublicSiteService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly config = SITE_CONFIG;
  protected readonly inputClass = INPUT_CLASS;
  protected readonly steps = STEPS;
  protected readonly genders = [
    { value: 'male' as const, label: 'doctors.male' as const },
    { value: 'female' as const, label: 'doctors.female' as const },
  ];

  /* ------------------------------------------------ query-param prefill */

  readonly doctorParam = input(undefined, {
    alias: 'doctor',
    transform: (value: unknown) => (value === undefined ? undefined : numberAttribute(value, Number.NaN)),
  });
  readonly departmentParam = input('', { alias: 'department', transform: (value: string | undefined) => value ?? '' });
  readonly dateParam = input('', { alias: 'date', transform: (value: string | undefined) => value ?? '' });

  /* ----------------------------------------------------------- wizard */

  protected readonly step = signal<Step>(1);
  protected readonly departmentSlug = linkedSignal(() => this.departmentParam());
  protected readonly doctorSearch = signal('');
  protected readonly doctorId = signal<number | null>(null);
  protected readonly date = signal('');
  protected readonly startTime = signal('');
  protected readonly slotError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  private readonly apiError = signal<ApiError | null>(null);

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  /** Everyone in the department at once: the picker is a short list, not a directory. */
  protected readonly doctorList = this.site.doctorsResource(() => ({
    search: '',
    department: this.departmentSlug(),
    day: '',
    gender: '',
    page: 1,
    pageSize: 100,
  }));

  /** Search is local — the list is small and filtering should feel instant. */
  protected readonly filteredDoctors = computed(() => {
    const term = this.doctorSearch().trim().toLowerCase();
    const all = this.doctorList.value()?.items ?? [];
    if (term === '') {
      return all;
    }
    return all.filter((doctor) =>
      [doctor.name.en, doctor.name.bn, doctor.specialty.en, doctor.specialty.bn].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  });

  /** Fetched separately so a `?doctor=` link works before the list has loaded. */
  private readonly doctorRef = this.site.doctorResource(() => this.doctorId() ?? undefined);
  protected readonly doctor = computed<PublicDoctor | undefined>(() => {
    const id = this.doctorId();
    if (id === null) {
      return undefined;
    }
    return this.doctorList.value()?.items.find((doctor) => doctor.id === id) ?? this.doctorRef.value();
  });

  protected readonly dates = computed(() => {
    const d = this.doctor();
    const lang = this.i18n.lang();
    const working = new Set(d?.chamber.map((time) => time.weekday) ?? []);
    const days = [];
    const cursor = new Date();
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
      const iso = toIsoDate(cursor);
      days.push({
        iso,
        weekday: weekdayShort(cursor.getDay(), lang),
        day: dayOfMonth(iso, lang),
        month: monthShort(iso, lang),
        full: formatDate(iso, lang),
        available: working.has(cursor.getDay()),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  });

  protected readonly slots = this.site.slotsResource(() => {
    const id = this.doctorId();
    const date = this.date();
    return id === null || date === '' ? undefined : { doctorId: id, date };
  });

  protected readonly availableCount = computed(
    () => this.slots.value()?.filter((slot) => slot.isAvailable).length ?? 0,
  );

  protected readonly slotGroups = computed(() => {
    const all = this.slots.value() ?? [];
    const hour = (slot: PublicSlot): number => Number(slot.startTime.slice(0, 2));
    return [
      { label: 'book.time.morning' as const, slots: all.filter((slot) => hour(slot) < AFTERNOON_FROM) },
      { label: 'book.time.afternoon' as const, slots: all.filter((slot) => hour(slot) >= AFTERNOON_FROM) },
    ];
  });

  /* ---------------------------------------------------------- details */

  protected readonly model = signal<PatientDetails>({ name: '', phone: '', age: '', gender: '', reason: '' });
  private readonly detailsSubmitted = signal(false);

  // Messages come from `i18n.t` inside the validators, so they are reactive
  // and switch language along with the rest of the page.
  protected readonly details = form(
    this.model,
    schema<PatientDetails>((path) => {
      validate(path.name, ({ value }) =>
        value().trim().length < 2 ? { kind: 'name', message: this.i18n.t('book.err.name') } : null,
      );
      validate(path.phone, ({ value }) =>
        BD_PHONE_PATTERN.test(normalisePhone(value())) ? null : { kind: 'phone', message: this.i18n.t('book.err.phone') },
      );
      validate(path.age, ({ value }) => {
        const age = Number(value());
        return /^\d{1,3}$/.test(value().trim()) && age <= 120
          ? null
          : { kind: 'age', message: this.i18n.t('book.err.age') };
      });
      validate(path.gender, ({ value }) =>
        value() === '' ? { kind: 'gender', message: this.i18n.t('book.err.gender') } : null,
      );
      validate(path.reason, ({ value }) =>
        value().length > REASON_MAX_LENGTH
          ? { kind: 'maxLength', message: this.i18n.t('common.tooLong', { n: REASON_MAX_LENGTH }) }
          : null,
      );
    }),
  );

  protected readonly genderError = computed(() => {
    const state = this.details.gender();
    const show = this.detailsSubmitted() || state.touched();
    return show ? (state.errors()[0]?.message ?? this.serverError('gender')) : this.serverError('gender');
  });

  constructor() {
    const seo = inject(SeoService);
    effect(() => seo.set({ title: this.i18n.t('book.title'), description: this.i18n.t('book.lead') }));

    // Apply `?doctor=&date=` once. `untracked` so later wizard state changes
    // do not re-trigger the prefill.
    effect(() => {
      const id = this.doctorParam();
      const date = this.dateParam();
      untracked(() => {
        if (id === undefined || Number.isNaN(id)) {
          return;
        }
        this.doctorId.set(id);
        this.step.set(2);
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          this.date.set(date);
        }
      });
    });

    // A prefilled date the doctor does not actually sit on is dropped.
    effect(() => {
      const chosen = this.date();
      const d = this.doctor();
      if (chosen === '' || d === undefined) {
        return;
      }
      if (!d.chamber.some((time) => time.weekday === parseIsoDate(chosen).getDay())) {
        untracked(() => this.date.set(''));
      }
    });
  }

  /* ---------------------------------------------------------- actions */

  protected canVisit(target: Step): boolean {
    if (target === 1) return true;
    if (target === 2) return this.doctorId() !== null;
    if (target === 3) return this.startTime() !== '';
    return this.startTime() !== '' && this.details().valid();
  }

  protected goTo(target: Step): void {
    if (!this.canVisit(target)) {
      return;
    }
    this.step.set(target);
    this.focusPanel();
  }

  protected chooseDoctor(doctor: PublicDoctor): void {
    if (this.doctorId() !== doctor.id) {
      this.doctorId.set(doctor.id);
      this.date.set('');
      this.startTime.set('');
    }
    this.goTo(2);
  }

  protected chooseDate(iso: string): void {
    this.date.set(iso);
    this.startTime.set('');
    this.slotError.set(null);
  }

  protected setGender(value: Gender): void {
    this.model.update((current) => ({ ...current, gender: value }));
    this.details.gender().markAsTouched();
  }

  protected async toReview(event: Event): Promise<void> {
    event.preventDefault();
    this.detailsSubmitted.set(true);
    this.apiError.set(null);
    await submit(this.details, async () => {
      this.goTo(4);
      return null;
    });
  }

  protected async confirm(): Promise<void> {
    const d = this.doctor();
    const details = this.model();
    if (d === undefined || details.gender === '') {
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    try {
      const confirmation = await this.site.book({
        doctorId: d.id,
        date: this.date(),
        startTime: this.startTime(),
        name: details.name,
        phone: normalisePhone(details.phone),
        age: Number(details.age),
        gender: details.gender,
        reason: details.reason,
      });
      await this.router.navigate(['/book/confirmation', confirmation.reference]);
    } catch (caught: unknown) {
      const error = toApiError(caught);
      this.apiError.set(error);
      if (fieldError(error, 'start_time') !== null) {
        // The slot went while the visitor was typing: send them back to pick again.
        this.slotError.set(fieldError(error, 'start_time'));
        this.startTime.set('');
        this.slots.reload();
        this.goTo(2);
      } else if (['name', 'phone', 'age', 'gender'].some((field) => fieldError(error, field) !== null)) {
        this.goTo(3);
      } else {
        this.submitError.set(error.message);
      }
    } finally {
      this.submitting.set(false);
    }
  }

  /* ---------------------------------------------------------- display */

  protected serverError(field: string): string | null {
    return fieldError(this.apiError(), field);
  }

  protected chipClass(active: boolean): string {
    const base = 'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors';
    return active
      ? `${base} bg-brand-600 text-white`
      : `${base} bg-surface-sunken text-surface-fg hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950 dark:hover:text-brand-300`;
  }

  protected chamberDays(doctor: PublicDoctor): string {
    const lang = this.i18n.lang();
    return [6, 0, 1, 2, 3, 4, 5]
      .filter((weekday) => doctor.chamber.some((time) => time.weekday === weekday))
      .map((weekday) => weekdayShort(weekday, lang))
      .join(', ');
  }

  protected time(value: string): string {
    return formatTime(value, this.i18n.lang());
  }

  protected longDate(iso: string): string {
    return formatDate(iso, this.i18n.lang());
  }

  private focusPanel(): void {
    // Move focus to the new step so screen-reader and keyboard users land on it.
    queueMicrotask(() => this.panel().nativeElement.focus({ preventScroll: false }));
  }
}
