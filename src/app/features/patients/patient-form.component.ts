import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, form, maxLength, required, schema, submit } from '@angular/forms/signals';
import { PatientService } from './patient.service';
import { ToastService } from '../../core/services/toast.service';
import { toApiError, type ApiError } from '../../core/http/api-error';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { FormFieldComponent } from '../../shared/ui/form-field/form-field.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { bdPhone, bloodGroup, nid, notInFuture, BLOOD_GROUPS } from '../../shared/validators/hms-validators';
import { emptyPatientInput, toPatientInput } from '../../shared/models/patient.dto';
import { GENDER_LABELS, type PatientInput } from '../../shared/models/patient.model';

/**
 * Validation lives in a schema rather than on the controls, so the same rules
 * could be reused by an import job or a bulk-edit screen without touching UI.
 */
const patientSchema = schema<PatientInput>((path) => {
  required(path.fullName, { message: 'Patient name is required.' });
  maxLength(path.fullName, 120);

  required(path.dateOfBirth, { message: 'Date of birth is required.' });
  notInFuture(path.dateOfBirth, 'Date of birth');

  required(path.phone, { message: 'A contact number is required.' });
  bdPhone(path.phone);

  nid(path.nid);
  bloodGroup(path.bloodGroup);

  required(path.address, { message: 'Address is required.' });
  maxLength(path.address, 255);

  bdPhone(path.emergencyContactPhone);
});

const INPUT_CLASS =
  'h-10 w-full rounded-control bg-surface px-3 text-sm text-surface-fg ring-1 ring-inset ring-surface-border placeholder:text-surface-fg-muted focus:ring-2 focus:ring-brand-500';

@Component({
  selector: 'hms-patient-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormField,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    FormFieldComponent,
    SkeletonComponent,
  ],
  template: `
    <hms-page-header
      [heading]="isEdit() ? 'Edit patient' : 'Register patient'"
      [description]="
        isEdit()
          ? 'Update demographics and contact details.'
          : 'Capture demographics for a new outpatient or inpatient record.'
      "
    />

    @if (isEdit() && patients.isDetailLoading()) {
      <hms-card><hms-skeleton [lines]="8" [height]="16" label="Loading patient" /></hms-card>
    } @else {
      <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
        <hms-card heading="Demographics">
          <div class="grid gap-4 sm:grid-cols-2">
            <hms-form-field
              class="sm:col-span-2"
              label="Full name"
              controlId="patient-name"
              [field]="patientForm.fullName"
              [required]="true"
              [serverError]="serverError('full_name')"
            >
              <input id="patient-name" type="text" [class]="inputClass" [formField]="patientForm.fullName" />
            </hms-form-field>

            <hms-form-field label="Gender" controlId="patient-gender" [field]="patientForm.gender">
              <select id="patient-gender" [class]="inputClass" [formField]="patientForm.gender">
                @for (entry of genderOptions; track entry.value) {
                  <option [value]="entry.value">{{ entry.label }}</option>
                }
              </select>
            </hms-form-field>

            <hms-form-field
              label="Date of birth"
              controlId="patient-dob"
              [field]="patientForm.dateOfBirth"
              [required]="true"
              [serverError]="serverError('date_of_birth')"
            >
              <input id="patient-dob" type="date" [class]="inputClass" [formField]="patientForm.dateOfBirth" />
            </hms-form-field>

            <hms-form-field
              label="Blood group"
              controlId="patient-blood"
              [field]="patientForm.bloodGroup"
              hint="Leave blank if not yet typed."
            >
              <select id="patient-blood" [class]="inputClass" [formField]="patientForm.bloodGroup">
                <option value="">Unknown</option>
                @for (group of bloodGroups; track group) {
                  <option [value]="group">{{ group }}</option>
                }
              </select>
            </hms-form-field>

            <hms-form-field
              label="Patient type"
              controlId="patient-type"
              [field]="patientForm.type"
              hint="Inpatient records still need a bed assigned separately."
            >
              <select id="patient-type" [class]="inputClass" [formField]="patientForm.type">
                <option value="opd">Outpatient (OPD)</option>
                <option value="ipd">Inpatient (IPD)</option>
              </select>
            </hms-form-field>
          </div>
        </hms-card>

        <hms-card heading="Contact">
          <div class="grid gap-4 sm:grid-cols-2">
            <hms-form-field
              label="Mobile number"
              controlId="patient-phone"
              [field]="patientForm.phone"
              [required]="true"
              hint="e.g. 01712345678"
              [serverError]="serverError('phone')"
            >
              <input id="patient-phone" type="tel" [class]="inputClass" [formField]="patientForm.phone" />
            </hms-form-field>

            <hms-form-field label="Email" controlId="patient-email" [field]="patientForm.email">
              <input id="patient-email" type="email" [class]="inputClass" [formField]="patientForm.email" />
            </hms-form-field>

            <hms-form-field
              label="NID"
              controlId="patient-nid"
              [field]="patientForm.nid"
              hint="10, 13 or 17 digits."
              [serverError]="serverError('nid')"
            >
              <input id="patient-nid" type="text" inputmode="numeric" [class]="inputClass" [formField]="patientForm.nid" />
            </hms-form-field>

            <hms-form-field
              class="sm:col-span-2"
              label="Address"
              controlId="patient-address"
              [field]="patientForm.address"
              [required]="true"
              [serverError]="serverError('address')"
            >
              <input id="patient-address" type="text" [class]="inputClass" [formField]="patientForm.address" />
            </hms-form-field>
          </div>
        </hms-card>

        <hms-card heading="Emergency contact & allergies">
          <div class="grid gap-4 sm:grid-cols-2">
            <hms-form-field
              label="Contact name"
              controlId="patient-ec-name"
              [field]="patientForm.emergencyContactName"
            >
              <input id="patient-ec-name" type="text" [class]="inputClass" [formField]="patientForm.emergencyContactName" />
            </hms-form-field>

            <hms-form-field
              label="Contact number"
              controlId="patient-ec-phone"
              [field]="patientForm.emergencyContactPhone"
            >
              <input id="patient-ec-phone" type="tel" [class]="inputClass" [formField]="patientForm.emergencyContactPhone" />
            </hms-form-field>

            <hms-form-field
              class="sm:col-span-2"
              label="Known allergies"
              controlId="patient-allergies"
              [field]="patientForm.allergies"
              hint="Comma-separated, e.g. Penicillin, Latex"
            >
              <input id="patient-allergies" type="text" [class]="inputClass" [formField]="patientForm.allergies" />
            </hms-form-field>
          </div>
        </hms-card>

        <div class="flex items-center justify-end gap-2">
          <hms-button variant="secondary" (pressed)="cancel()">Cancel</hms-button>
          <hms-button type="submit" [loading]="saving()">
            {{ isEdit() ? 'Save changes' : 'Register patient' }}
          </hms-button>
        </div>
      </form>
    }
  `,
})
export class PatientFormComponent {
  protected readonly patients = inject(PatientService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Bound from the route param by `withComponentInputBinding()`. */
  readonly id = input<string | undefined>(undefined);

  protected readonly inputClass = INPUT_CLASS;
  protected readonly bloodGroups = BLOOD_GROUPS;
  protected readonly genderOptions = Object.entries(GENDER_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  protected readonly patientId = computed<number | null>(() => {
    const raw = this.id();
    if (raw === undefined || raw === 'new') {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  });

  protected readonly isEdit = computed(() => this.patientId() !== null);

  private readonly model = signal<PatientInput>(emptyPatientInput());
  protected readonly patientForm = form(this.model, patientSchema);

  protected readonly saving = signal(false);
  private readonly submitError = signal<ApiError | null>(null);

  constructor() {
    // Tell the service which record to load, then seed the form from it.
    effect(() => {
      this.patients.select(this.patientId());
    });

    effect(() => {
      const patient = this.patients.selectedPatient();
      if (patient !== undefined && patient.id === this.patientId()) {
        this.model.set(toPatientInput(patient));
      }
    });
  }

  protected serverError(field: string): string | null {
    return this.submitError()?.fieldErrors[field]?.[0] ?? null;
  }

  protected async cancel(): Promise<void> {
    await this.router.navigate(['/app/patients']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitError.set(null);

    await submit(this.patientForm, async () => {
      this.saving.set(true);
      try {
        const id = this.patientId();
        const saved =
          id === null
            ? await this.patients.create(this.model())
            : await this.patients.update(id, this.model());

        this.toast.success(
          id === null ? 'Patient registered' : 'Patient updated',
          `${saved.fullName} · ${saved.mrn}`,
        );
        await this.router.navigate(['/app/patients', saved.id]);
        return null;
      } catch (error: unknown) {
        const apiError = toApiError(error);
        this.submitError.set(apiError);
        return { kind: 'server', message: apiError.message };
      } finally {
        this.saving.set(false);
      }
    });
  }
}
