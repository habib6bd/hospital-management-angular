import {
  calculateAge,
  emptyPatientInput,
  toPatient,
  toPatientInput,
  toPatientWriteDto,
  type AdmissionDto,
  type PatientDto,
} from './patient.dto';

function patientDto(overrides: Partial<PatientDto> = {}): PatientDto {
  return {
    id: 7,
    mrn: 'HMS-2026-0007',
    full_name: 'Nasrin Akter',
    gender: 'female',
    date_of_birth: '1990-05-14',
    blood_group: 'B+',
    phone: '01712345678',
    email: 'nasrin@example.com',
    nid: '1234567890',
    address: 'Mirpur, Dhaka',
    patient_type: 'opd',
    emergency_contact_name: 'Kamrul Akter',
    emergency_contact_phone: '01812345678',
    allergies: ['Penicillin'],
    registered_at: '2026-01-02T09:30:00Z',
    current_admission: null,
    ...overrides,
  };
}

const admitted: AdmissionDto = {
  id: 3,
  ward: 2,
  ward_name: 'General Ward B',
  bed: 21,
  bed_number: 'GWB-01',
  admitted_at: '2026-03-01T11:00:00Z',
  discharged_at: null,
  attending_doctor_name: 'Dr. Imran Hossain',
  summary_report: null,
};

describe('patient mappers', () => {
  it('maps snake_case fields onto the domain model', () => {
    const patient = toPatient(patientDto());

    expect(patient.fullName).toBe('Nasrin Akter');
    expect(patient.dateOfBirth).toBe('1990-05-14');
    expect(patient.emergencyContactPhone).toBe('01812345678');
    expect(patient.bloodGroup).toBe('B+');
  });

  it('rejects a blood group the backend should never send', () => {
    expect(toPatient(patientDto({ blood_group: 'Z+' })).bloodGroup).toBeNull();
    expect(toPatient(patientDto({ blood_group: null })).bloodGroup).toBeNull();
  });

  it('falls back safely on unknown enum values rather than trusting the wire', () => {
    const patient = toPatient(patientDto({ gender: 'unknown-value', patient_type: 'daycare' }));
    expect(patient.gender).toBe('other');
    expect(patient.type).toBe('opd');
  });

  it('narrows an open admission to the admitted variant', () => {
    const patient = toPatient(patientDto({ current_admission: admitted }));

    expect(patient.admission.status).toBe('admitted');
    if (patient.admission.status === 'admitted') {
      expect(patient.admission.bedNumber).toBe('GWB-01');
      expect(patient.admission.wardName).toBe('General Ward B');
    }
  });

  it('narrows a closed admission to the discharged variant', () => {
    const patient = toPatient(
      patientDto({
        current_admission: { ...admitted, discharged_at: '2026-03-06T08:00:00Z' },
      }),
    );

    expect(patient.admission.status).toBe('discharged');
    if (patient.admission.status === 'discharged') {
      expect(patient.admission.dischargedAt).toBe('2026-03-06T08:00:00Z');
    }
  });

  it('reports no admission when the field is null', () => {
    expect(toPatient(patientDto()).admission.status).toBe('none');
  });

  it('round-trips through the form model without losing data', () => {
    const original = toPatient(patientDto());
    const restored = toPatient(
      patientDto({
        ...toPatientWriteDto(toPatientInput(original)),
      } as Partial<PatientDto>),
    );

    expect(restored.fullName).toBe(original.fullName);
    expect(restored.phone).toBe(original.phone);
    expect(restored.nid).toBe(original.nid);
    expect(restored.allergies).toEqual(original.allergies);
  });

  it('splits the comma-separated allergy field into a list for the API', () => {
    const dto = toPatientWriteDto({
      ...emptyPatientInput(),
      fullName: ' Rafiqul Islam ',
      allergies: 'Penicillin, Latex ,, Peanuts',
    });

    expect(dto['allergies']).toEqual(['Penicillin', 'Latex', 'Peanuts']);
    expect(dto['full_name']).toBe('Rafiqul Islam');
  });

  it('sends null rather than an empty string for optional fields', () => {
    const dto = toPatientWriteDto(emptyPatientInput());

    expect(dto['email']).toBeNull();
    expect(dto['nid']).toBeNull();
    expect(dto['blood_group']).toBeNull();
  });
});

describe('calculateAge', () => {
  it('counts whole years only', () => {
    const now = new Date('2026-05-13T00:00:00Z');
    expect(calculateAge('1990-05-14', now)).toBe(35);
    expect(calculateAge('1990-05-13', now)).toBe(36);
  });

  it('never returns a negative age for a bad date', () => {
    expect(calculateAge('not-a-date')).toBe(0);
    expect(calculateAge('2099-01-01')).toBe(0);
  });
});
