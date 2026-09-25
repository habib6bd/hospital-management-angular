import type { Localized } from '../../core/i18n/i18n.model';
import { isIconName } from '../ui/icon/icon.component';
import type {
  BookingConfirmation,
  ChamberTime,
  Department,
  Gender,
  GuestBookingInput,
  HealthPackage,
  HospitalService,
  PublicDoctor,
  PublicSlot,
  ServiceCategory,
  Testimonial,
} from './public.model';

/** Wire shapes for `/api/public/**` — snake_case, as DRF serialises them. */

export interface DepartmentDto {
  readonly slug: string;
  readonly name: Localized;
  readonly summary: Localized;
  readonly description: Localized;
  readonly icon: string;
  readonly image: string;
  readonly services: readonly Localized[];
  readonly doctor_count: number;
}

export interface ChamberTimeDto {
  readonly weekday: number;
  readonly start_time: string;
  readonly end_time: string;
}

export interface PublicDoctorDto {
  readonly id: number;
  readonly name: Localized;
  readonly specialty: Localized;
  readonly department_slug: string;
  readonly department_name: Localized;
  readonly designation: Localized;
  readonly qualifications: string;
  readonly experience_years: number;
  readonly consultation_fee: string;
  readonly room_number: string;
  readonly gender: string;
  readonly languages: Localized;
  readonly bio: Localized;
  readonly photo_url: string | null;
  readonly chamber: readonly ChamberTimeDto[];
}

export interface HospitalServiceDto {
  readonly slug: string;
  readonly name: Localized;
  readonly summary: Localized;
  readonly description: Localized;
  readonly icon: string;
  readonly image: string;
  readonly category: string;
  readonly features: readonly Localized[];
  readonly is_emergency: boolean;
}

export interface HealthPackageDto {
  readonly id: number;
  readonly name: Localized;
  readonly price: string;
  readonly tests: readonly Localized[];
  readonly is_popular: boolean;
}

export interface TestimonialDto {
  readonly id: number;
  readonly name: Localized;
  readonly location: Localized;
  readonly quote: Localized;
}

export interface PublicSlotDto {
  readonly start_time: string;
  readonly end_time: string;
  readonly is_available: boolean;
}

export interface GuestBookingDto {
  readonly doctor: number;
  readonly date: string;
  readonly start_time: string;
  readonly name: string;
  readonly phone: string;
  readonly age: number;
  readonly gender: string;
  readonly reason: string;
}

export interface BookingConfirmationDto {
  readonly reference: string;
  readonly serial_no: number;
  readonly doctor: number;
  readonly doctor_name: Localized;
  readonly specialty: Localized;
  readonly date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly room_number: string;
  readonly consultation_fee: string;
  readonly patient_name: string;
  readonly phone: string;
}

function toGender(value: string): Gender {
  return value === 'female' ? 'female' : 'male';
}

function toCategory(value: string): ServiceCategory {
  return value === 'diagnostic' || value === 'support' ? value : 'clinical';
}

function toMoney(value: string): number {
  const amount = Number.parseFloat(value);
  return Number.isNaN(amount) ? 0 : amount;
}

export function toDepartment(dto: DepartmentDto): Department {
  return {
    slug: dto.slug,
    name: dto.name,
    summary: dto.summary,
    description: dto.description,
    icon: isIconName(dto.icon) ? dto.icon : 'stethoscope',
    image: dto.image,
    services: dto.services,
    doctorCount: dto.doctor_count,
  };
}

function toChamberTime(dto: ChamberTimeDto): ChamberTime {
  return { weekday: dto.weekday, startTime: dto.start_time, endTime: dto.end_time };
}

export function toPublicDoctor(dto: PublicDoctorDto): PublicDoctor {
  return {
    id: dto.id,
    name: dto.name,
    specialty: dto.specialty,
    departmentSlug: dto.department_slug,
    departmentName: dto.department_name,
    designation: dto.designation,
    qualifications: dto.qualifications,
    experienceYears: dto.experience_years,
    fee: toMoney(dto.consultation_fee),
    room: dto.room_number,
    gender: toGender(dto.gender),
    languages: dto.languages,
    bio: dto.bio,
    photoUrl: dto.photo_url,
    chamber: dto.chamber.map(toChamberTime),
  };
}

export function toHospitalService(dto: HospitalServiceDto): HospitalService {
  return {
    slug: dto.slug,
    name: dto.name,
    summary: dto.summary,
    description: dto.description,
    icon: isIconName(dto.icon) ? dto.icon : 'heart',
    image: dto.image,
    category: toCategory(dto.category),
    features: dto.features,
    isEmergency: dto.is_emergency,
  };
}

export function toHealthPackage(dto: HealthPackageDto): HealthPackage {
  return {
    id: dto.id,
    name: dto.name,
    price: toMoney(dto.price),
    tests: dto.tests,
    isPopular: dto.is_popular,
  };
}

export function toTestimonial(dto: TestimonialDto): Testimonial {
  return { id: dto.id, name: dto.name, location: dto.location, quote: dto.quote };
}

export function toPublicSlot(dto: PublicSlotDto): PublicSlot {
  return { startTime: dto.start_time, endTime: dto.end_time, isAvailable: dto.is_available };
}

export function toGuestBookingDto(input: GuestBookingInput): GuestBookingDto {
  return {
    doctor: input.doctorId,
    date: input.date,
    start_time: input.startTime,
    name: input.name.trim(),
    phone: input.phone,
    age: input.age,
    gender: input.gender,
    reason: input.reason.trim(),
  };
}

export function toBookingConfirmation(dto: BookingConfirmationDto): BookingConfirmation {
  return {
    reference: dto.reference,
    serialNo: dto.serial_no,
    doctorId: dto.doctor,
    doctorName: dto.doctor_name,
    specialty: dto.specialty,
    date: dto.date,
    startTime: dto.start_time,
    endTime: dto.end_time,
    room: dto.room_number,
    fee: toMoney(dto.consultation_fee),
    patientName: dto.patient_name,
    phone: dto.phone,
  };
}
