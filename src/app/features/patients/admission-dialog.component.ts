import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, schema, submit } from '@angular/forms/signals';
import { PatientService, WardService } from './patient.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import type { Patient } from '../../shared/models/patient.model';

interface AdmitModel {
  wardId: string;
  bedId: string;
  attendingDoctor: string;
  reason: string;
}

interface DischargeModel {
  summary: string;
  followUpDate: string;
}

const admitSchema = schema<AdmitModel>((path) => {
  required(path.wardId, { message: 'Select a ward.' });
  required(path.bedId, { message: 'Select an available bed.' });
  required(path.attendingDoctor, { message: 'Enter the attending doctor.' });
});

const dischargeSchema = schema<DischargeModel>((path) => {
  required(path.summary, { message: 'A discharge summary is required.' });
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-admission-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, ModalComponent, ButtonComponent, FormFieldComponent, SkeletonComponent],
  template: `
    <hms-modal
      [heading]="mode() === 'admit' ? 'Admit patient' : 'Discharge patient'"
      [description]="patient().fullName + ' · ' + patient().mrn"
      [busy]="saving()"
      (closed)="closed.emit()"
    >
      @if (mode() === 'admit') {
        <div class="flex flex-col gap-4">
          <hms-form-field
            label="Ward"
            controlId="admit-ward"
            [field]="admitForm.wardId"
            [required]="true"
          >
            <select
              id="admit-ward"
              [class]="inputClass"
              [formField]="admitForm.wardId"
              (change)="onWardSelected($event)"
            >
              <option value="">Select a ward</option>
              @for (ward of wards.wards(); track ward.id) {
                <option [value]="ward.id" [disabled]="ward.occupiedBeds >= ward.totalBeds">
                  {{ ward.name }} ({{ ward.totalBeds - ward.occupiedBeds }} free)
                </option>
              }
            </select>
          </hms-form-field>

          <hms-form-field
            label="Bed"
            controlId="admit-bed"
            [field]="admitForm.bedId"
            [required]="true"
            [serverError]="serverError('bed')"
            hint="Only beds marked available are listed."
          >
            @if (wards.isBedsLoading()) {
              <hms-skeleton [lines]="1" [height]="40" label="Loading beds" />
            } @else {
              <select id="admit-bed" [class]="inputClass" [formField]="admitForm.bedId">
                <option value="">Select a bed</option>
                @for (bed of availableBeds(); track bed.id) {
                  <option [value]="bed.id">{{ bed.bedNumber }}</option>
                }
              </select>
              @if (availableBeds().length === 0 && admitForm.wardId().value() !== '') {
                <p class="mt-1 text-xs text-status-pending-strong">
                  No free beds in this ward. Choose another ward.
                </p>
              }
            }
          </hms-form-field>

          <hms-form-field
            label="Attending doctor"
            controlId="admit-doctor"
            [field]="admitForm.attendingDoctor"
            [required]="true"
          >
            <input id="admit-doctor" type="text" [class]="inputClass" [formField]="admitForm.attendingDoctor" />
          </hms-form-field>

          <hms-form-field label="Reason for admission" controlId="admit-reason" [field]="admitForm.reason">
            <input id="admit-reason" type="text" [class]="inputClass" [formField]="admitForm.reason" />
          </hms-form-field>
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          <p class="rounded-control bg-status-pending-soft px-3 py-2 text-xs text-status-pending-strong">
            Discharging releases the bed for cleaning and closes the admission record.
          </p>

          <hms-form-field
            label="Discharge summary"
            controlId="discharge-summary"
            [field]="dischargeForm.summary"
            [required]="true"
          >
            <textarea
              id="discharge-summary"
              rows="4"
              class="w-full rounded-control bg-surface px-3 py-2 text-sm text-surface-fg ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-brand-500"
              [formField]="dischargeForm.summary"
            ></textarea>
          </hms-form-field>

          <hms-form-field label="Follow-up date" controlId="discharge-followup" [field]="dischargeForm.followUpDate">
            <input id="discharge-followup" type="date" [class]="inputClass" [formField]="dischargeForm.followUpDate" />
          </hms-form-field>
        </div>
      }

      @if (generalError() !== null) {
        <p class="mt-3 rounded-control bg-status-critical-soft px-3 py-2 text-xs text-status-critical-strong" role="alert">
          {{ generalError() }}
        </p>
      }

      <div modal-footer class="contents">
        <hms-button variant="secondary" [disabled]="saving()" (pressed)="closed.emit()">
          Cancel
        </hms-button>
        <hms-button
          [variant]="mode() === 'discharge' ? 'danger' : 'primary'"
          [loading]="saving()"
          (pressed)="onConfirm()"
        >
          {{ mode() === 'admit' ? 'Admit' : 'Discharge' }}
        </hms-button>
      </div>
    </hms-modal>
  `,
})
export class AdmissionDialogComponent {
  protected readonly wards = inject(WardService);
  private readonly patients = inject(PatientService);

  readonly patient = input.required<Patient>();
  readonly mode = input.required<'admit' | 'discharge'>();

  readonly closed = output<void>();
  readonly completed = output<string>();

  protected readonly inputClass = INPUT_CLASS;
  protected readonly saving = signal(false);
  private readonly error = signal<ApiError | null>(null);

  private readonly admitModel = signal<AdmitModel>({
    wardId: '',
    bedId: '',
    attendingDoctor: '',
    reason: '',
  });
  private readonly dischargeModel = signal<DischargeModel>({ summary: '', followUpDate: '' });

  protected readonly admitForm = form(this.admitModel, admitSchema);
  protected readonly dischargeForm = form(this.dischargeModel, dischargeSchema);

  protected readonly availableBeds = this.wards.availableBeds;

  protected readonly generalError = computed(() => {
    const current = this.error();
    return current === null || Object.keys(current.fieldErrors).length > 0 ? null : current.message;
  });

  protected serverError(field: string): string | null {
    return this.error()?.fieldErrors[field]?.[0] ?? null;
  }

  protected onWardSelected(event: Event): void {
    const wardId = Number((event.target as HTMLSelectElement).value);
    // Clear the bed: the previously chosen one belongs to the old ward.
    this.admitModel.update((current) => ({ ...current, bedId: '' }));
    if (Number.isFinite(wardId) && wardId > 0) {
      this.wards.selectWard(wardId);
    }
  }

  protected async onConfirm(): Promise<void> {
    this.error.set(null);
    return this.mode() === 'admit' ? this.confirmAdmit() : this.confirmDischarge();
  }

  private async confirmAdmit(): Promise<void> {
    await submit(this.admitForm, async () => {
      this.saving.set(true);
      try {
        const model = this.admitModel();
        await this.patients.admit({
          patientId: this.patient().id,
          wardId: Number(model.wardId),
          bedId: Number(model.bedId),
          attendingDoctorId: 0,
          attendingDoctorName: model.attendingDoctor,
          reason: model.reason,
        });
        this.completed.emit(`${this.patient().fullName} admitted.`);
        return null;
      } catch (caught: unknown) {
        const apiError = toApiError(caught);
        this.error.set(apiError);
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }

  private async confirmDischarge(): Promise<void> {
    const admission = this.patient().admission;
    if (admission.status !== 'admitted') {
      return;
    }

    await submit(this.dischargeForm, async () => {
      this.saving.set(true);
      try {
        const model = this.dischargeModel();
        await this.patients.discharge(this.patient().id, {
          admissionId: admission.admissionId,
          summary: model.summary,
          followUpDate: model.followUpDate,
        });
        this.completed.emit(`${this.patient().fullName} discharged.`);
        return null;
      } catch (caught: unknown) {
        const apiError = toApiError(caught);
        this.error.set(apiError);
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }
}
