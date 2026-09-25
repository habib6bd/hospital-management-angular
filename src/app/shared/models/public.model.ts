import type { Localized } from '../../core/i18n/i18n.model';
import type { IconName } from '../ui/icon/icon.component';

/** Models behind the public website. Text the visitor reads is `Localized`. */

export interface Department {
  readonly slug: string;
  readonly name: Localized;
  readonly summary: Localized;
  readonly description: Localized;
  readonly icon: IconName;
  /** Card and header photo, served from `public/images`. */
  readonly image: string;
  readonly services: readonly Localized[];
  readonly doctorCount: number;
}

export type Gender = 'male' | 'female';

export interface ChamberTime {
  /** 0 = Sunday, matching `Date.getDay()`. */
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
}

export interface PublicDoctor {
  readonly id: number;
  readonly name: Localized;
  readonly specialty: Localized;
  readonly departmentSlug: string;
  readonly departmentName: Localized;
  readonly designation: Localized;
  readonly qualifications: string;
  readonly experienceYears: number;
  readonly fee: number;
  readonly room: string;
  readonly gender: Gender;
  readonly languages: Localized;
  readonly bio: Localized;
  readonly photoUrl: string | null;
  readonly chamber: readonly ChamberTime[];
}

export type ServiceCategory = 'clinical' | 'diagnostic' | 'support';

export interface HospitalService {
  readonly slug: string;
  readonly name: Localized;
  readonly summary: Localized;
  readonly description: Localized;
  readonly icon: IconName;
  readonly image: string;
  readonly category: ServiceCategory;
  readonly features: readonly Localized[];
  readonly isEmergency: boolean;
}

export interface HealthPackage {
  readonly id: number;
  readonly name: Localized;
  readonly price: number;
  readonly tests: readonly Localized[];
  readonly isPopular: boolean;
}

export interface Testimonial {
  readonly id: number;
  readonly name: Localized;
  readonly location: Localized;
  readonly quote: Localized;
}

export interface PublicSlot {
  readonly startTime: string;
  readonly endTime: string;
  readonly isAvailable: boolean;
}

export interface GuestBookingInput {
  readonly doctorId: number;
  readonly date: string;
  readonly startTime: string;
  readonly name: string;
  readonly phone: string;
  readonly age: number;
  readonly gender: Gender;
  readonly reason: string;
}

export interface BookingConfirmation {
  readonly reference: string;
  readonly serialNo: number;
  readonly doctorId: number;
  readonly doctorName: Localized;
  readonly specialty: Localized;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly room: string;
  readonly fee: number;
  readonly patientName: string;
  readonly phone: string;
}

export interface ContactInput {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
}

export interface DoctorQuery {
  readonly search: string;
  readonly department: string;
  /** Weekday number as a string, or '' for any day. */
  readonly day: string;
  readonly gender: Gender | '';
  readonly page: number;
  /** Defaults to the directory's page size; the booking picker asks for everyone. */
  readonly pageSize?: number;
}
