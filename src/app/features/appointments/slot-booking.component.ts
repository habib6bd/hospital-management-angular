import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, required, schema, submit } from '@angular/forms/signals';
import { AppointmentService, DoctorService, todayIso } from './appointment.service';
import { PatientService } from '../patients/patient.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { inFuture } from '../../shared/validators/hms-validators';
import type { TimeSlot } from '../../shared/models/appointment.model';

interface BookingModel {
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  reason: string;
}

const bookingSchema = schema<BookingModel>((path) => {
  required(path.patientId, { message: 'Select a patient.' });
  required(path.doctorId, { message: 'Select a doctor.' });
  required(path.date, { message: 'Pick a date.' });
  inFuture(path.date, 'Appointment date');
  required(path.startTime, { message: 'Choose an available time slot.' });
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-slot-booking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    FormFieldComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <hms-page-header
      heading="Book appointment"
      description="Slots come from the doctor’s schedule for the chosen day."
    />

    <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
      <hms-card heading="Appointment details">
        <div class="grid gap-4 sm:grid-cols-2">
          <hms-form-field
            label="Patient"
            controlId="booking-patient"
            [field]="bookingForm.patientId"
            [required]="true"
            [serverError]="serverError('patient')"
          >
            <input
              id="booking-patient-search"
              type="search"
              placeholder="Search by name or MRN"
              class="mb-2 h-9 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              (input)="onPatientSearch($event)"
            />
            <select id="booking-patient" [class]="inputClass" [formField]="bookingForm.patientId">
              <option value="">Select a patient</option>
              @for (patient of patientOptions(); track patient.id) {
                <option [value]="patient.id">{{ patient.fullName }} — {{ patient.mrn }}</option>
              }
            </select>
          </hms-form-field>

          <hms-form-field
            label="Doctor"
            controlId="booking-doctor"
            [field]="bookingForm.doctorId"
            [required]="true"
            [serverError]="serverError('doctor')"
          >
            <select id="booking-doctor" [class]="inputClass" [formField]="bookingForm.doctorId">
              <option value="">Select a doctor</option>
              @for (doctor of doctors.doctors(); track doctor.id) {
                <option [value]="doctor.id">
                  {{ doctor.fullName }} — {{ doctor.specialty }} (room {{ doctor.roomNumber }})
                </option>
              }
            </select>
          </hms-form-field>

          <hms-form-field
            label="Date"
            controlId="booking-date"
            [field]="bookingForm.date"
            [required]="true"
            [serverError]="serverError('date')"
          >
            <input
              id="booking-date"
              type="date"
              [attr.min]="minDate"
              [class]="inputClass"
              [formField]="bookingForm.date"
            />
          </hms-form-field>

          <hms-form-field label="Reason" controlId="booking-reason" [field]="bookingForm.reason">
            <input id="booking-reason" type="text" [class]="inputClass" [formField]="bookingForm.reason" />
          </hms-form-field>
        </div>
      </hms-card>

      <hms-card heading="Available slots" [subheading]="slotSubheading()" [padded]="false">
        <div class="p-5">
          @if (!hasDoctorAndDate()) {
            <hms-empty-state
              title="Choose a doctor and date"
              description="Slots load from that doctor’s clinic hours for the selected day."
            />
          } @else if (slotsResource.isLoading()) {
            <hms-skeleton [lines]="3" [height]="36" label="Loading slots" />
          } @else if (slots().length === 0) {
            <hms-empty-state
              title="No clinic that day"
              description="This doctor does not sit on the selected weekday. Try another date."
            />
          } @else {
            <fieldset>
              <legend class="sr-only-focusable">Available appointment times</legend>
              <ul role="list" class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                @for (slot of slots(); track slot.startTime) {
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-control px-2 py-2 text-center text-xs font-mono font-medium ring-1 ring-inset transition-colors"
                      [class]="slotClass(slot)"
                      [disabled]="!slot.isAvailable"
                      [attr.aria-pressed]="model().startTime === slot.startTime"
                      [attr.aria-label]="slotLabel(slot)"
                      (click)="selectSlot(slot)"
                    >
                      {{ slot.startTime }}
                    </button>
                  </li>
                }
              </ul>
            </fieldset>

            @if (slotError() !== null) {
              <p class="mt-3 text-xs text-status-critical-strong" role="alert">{{ slotError() }}</p>
            }
          }
        </div>
      </hms-card>

      <div class="flex items-center justify-end gap-2">
        <hms-button variant="secondary" (pressed)="cancel()">Cancel</hms-button>
        <hms-button type="submit" [loading]="saving()">Book appointment</hms-button>
      </div>
    </form>
  `,
})
export class SlotBookingComponent {
  protected readonly doctors = inject(DoctorService);
  private readonly appointments = inject(AppointmentService);
  private readonly patients = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly minDate = todayIso();
  protected readonly saving = signal(false);
  private readonly submitError = signal<ApiError | null>(null);

  protected readonly model = signal<BookingModel>({
    patientId: '',
    doctorId: '',
    date: '',
    startTime: '',
    reason: '',
  });

  protected readonly bookingForm = form(this.model, bookingSchema);

  private readonly selectedDoctorId = computed<number | null>(() => {
    const raw = this.model().doctorId;
    return raw === '' ? null : Number(raw);
  });

  private readonly selectedDate = computed(() => this.model().date);

  protected readonly slotsResource = this.appointments.slotsFor(
    this.selectedDoctorId,
    this.selectedDate,
  );

  protected readonly slots = computed<readonly TimeSlot[]>(() =>
    this.appointments.mapSlots(this.slotsResource.value()),
  );

  protected readonly hasDoctorAndDate = computed(
    () => this.selectedDoctorId() !== null && this.selectedDate() !== '',
  );

  protected readonly slotSubheading = computed(() => {
    if (!this.hasDoctorAndDate()) {
      return null;
    }
    const available = this.slots().filter((slot) => slot.isAvailable).length;
    return `${available} of ${this.slots().length} slots free`;
  });

  protected readonly slotError = computed(
    () => this.submitError()?.fieldErrors['start_time']?.[0] ?? null,
  );

  protected readonly patientOptions = computed(() => this.patients.patients()?.items ?? []);

  constructor() {
    // Changing doctor or date invalidates the chosen time.
    effect(() => {
      this.selectedDoctorId();
      this.selectedDate();
      if (this.model().startTime !== '') {
        this.model.update((current) => ({ ...current, startTime: '' }));
      }
    });
  }

  protected onPatientSearch(event: Event): void {
    this.patients.patchQuery({ search: (event.target as HTMLInputElement).value });
  }

  protected selectSlot(slot: TimeSlot): void {
    if (!slot.isAvailable) {
      return;
    }
    this.submitError.set(null);
    this.model.update((current) => ({ ...current, startTime: slot.startTime }));
  }

  protected slotClass(slot: TimeSlot): string {
    if (this.model().startTime === slot.startTime) {
      return 'bg-brand-600 text-white ring-brand-600';
    }
    if (!slot.isAvailable) {
      return 'cursor-not-allowed bg-surface-sunken text-surface-fg-muted ring-surface-border line-through';
    }
    return 'bg-status-ready-soft text-status-ready-strong ring-status-ready/30 hover:bg-status-ready/20';
  }

  protected slotLabel(slot: TimeSlot): string {
    if (slot.isAvailable) {
      return `Book ${slot.startTime}`;
    }
    return slot.takenBy === null
      ? `${slot.startTime} unavailable`
      : `${slot.startTime} taken by ${slot.takenBy}`;
  }

  protected serverError(field: string): string | null {
    return this.submitError()?.fieldErrors[field]?.[0] ?? null;
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/appointments']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);

    await submit(this.bookingForm, async () => {
      this.saving.set(true);
      try {
        const current = this.model();
        const booked = await this.appointments.book({
          patientId: Number(current.patientId),
          doctorId: Number(current.doctorId),
          date: current.date,
          startTime: current.startTime,
          reason: current.reason,
        });

        this.toast.success(
          'Appointment booked',
          `${booked.patientName} with ${booked.doctorName} at ${booked.startTime} · token ${booked.tokenNumber}`,
        );
        await this.router.navigate(['/appointments']);
        return null;
      } catch (error: unknown) {
        const apiError = toApiError(error);
        this.submitError.set(apiError);
        // Someone else may have taken the slot; refresh so the grid is honest.
        this.slotsResource.reload();
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }
}
