import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { HttpClient, httpResource, type HttpResourceRef } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config';
import { authContext } from '../../core/http/http-context';
import { mapPage, toQueryParams, type Page, type PaginatedDto } from '../../core/http/paginated';
import {
  toBookingConfirmation,
  toDepartment,
  toGuestBookingDto,
  toHealthPackage,
  toHospitalService,
  toPublicDoctor,
  toPublicSlot,
  toTestimonial,
  type BookingConfirmationDto,
  type DepartmentDto,
  type HealthPackageDto,
  type HospitalServiceDto,
  type PublicDoctorDto,
  type PublicSlotDto,
  type TestimonialDto,
} from '../../shared/models/public.dto';
import type {
  BookingConfirmation,
  ContactInput,
  Department,
  DoctorQuery,
  GuestBookingInput,
  HealthPackage,
  HospitalService,
  PublicDoctor,
  PublicSlot,
  Testimonial,
} from '../../shared/models/public.model';

export const DOCTOR_PAGE_SIZE = 12;

/** A mapped view over an `httpResource`, so pages never see DTOs. */
export interface Loadable<T> {
  readonly value: Signal<T | undefined>;
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<unknown>;
  reload(): void;
}

function mapped<TDto, T>(ref: HttpResourceRef<TDto | undefined>, map: (dto: TDto) => T): Loadable<T> {
  return {
    value: computed(() => {
      const dto = ref.value();
      return dto === undefined ? undefined : map(dto);
    }),
    isLoading: ref.isLoading,
    error: ref.error,
    reload: () => ref.reload(),
  };
}

/**
 * Read and write access to `/api/public/**`.
 *
 * Site-wide lists (departments, services, packages, testimonials) are small and
 * appear on many pages, so they are single shared resources. Per-page data —
 * a doctor, a filtered list, a day's slots — comes from the `*Resource`
 * factories, which a component calls from a field initialiser so the resource
 * lives and dies with that page.
 */
@Injectable({ providedIn: 'root' })
export class PublicSiteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(APP_CONFIG).apiBaseUrl}/public`;

  private readonly departmentsRef = httpResource<PaginatedDto<DepartmentDto>>(() => `${this.baseUrl}/departments/`);
  private readonly servicesRef = httpResource<PaginatedDto<HospitalServiceDto>>(() => `${this.baseUrl}/services/`);
  private readonly packagesRef = httpResource<PaginatedDto<HealthPackageDto>>(() => `${this.baseUrl}/packages/`);
  private readonly testimonialsRef = httpResource<PaginatedDto<TestimonialDto>>(() => `${this.baseUrl}/testimonials/`);

  readonly departments = computed<readonly Department[]>(
    () => this.departmentsRef.value()?.results.map(toDepartment) ?? [],
  );
  readonly isDepartmentsLoading = this.departmentsRef.isLoading;

  readonly services = computed<readonly HospitalService[]>(
    () => this.servicesRef.value()?.results.map(toHospitalService) ?? [],
  );
  readonly isServicesLoading = this.servicesRef.isLoading;

  readonly packages = computed<readonly HealthPackage[]>(
    () => this.packagesRef.value()?.results.map(toHealthPackage) ?? [],
  );

  readonly testimonials = computed<readonly Testimonial[]>(
    () => this.testimonialsRef.value()?.results.map(toTestimonial) ?? [],
  );

  private readonly lastBookingSignal = signal<BookingConfirmation | null>(null);

  /**
   * The booking just made in this tab, handed from the wizard to the
   * confirmation page. Deliberately memory-only: a reload falls back to the
   * reference + phone lookup instead of keeping personal details in storage.
   */
  readonly lastBooking = this.lastBookingSignal.asReadonly();

  departmentBySlug(slug: string): Department | undefined {
    return this.departments().find((department) => department.slug === slug);
  }

  /* ------------------------------------------------ per-page resources */

  doctorsResource(query: () => DoctorQuery | undefined): Loadable<Page<PublicDoctor>> {
    const ref = httpResource<PaginatedDto<PublicDoctorDto>>(() => {
      const current = query();
      return current === undefined
        ? undefined
        : {
            url: `${this.baseUrl}/doctors/`,
            params: toQueryParams({
              search: current.search,
              department: current.department,
              day: current.day,
              gender: current.gender,
              page: current.page,
              page_size: current.pageSize ?? DOCTOR_PAGE_SIZE,
            }),
          };
    });
    return mapped(ref, (dto) =>
      mapPage(dto, toPublicDoctor, query()?.page ?? 1, query()?.pageSize ?? DOCTOR_PAGE_SIZE),
    );
  }

  doctorResource(id: () => number | undefined): Loadable<PublicDoctor> {
    const ref = httpResource<PublicDoctorDto>(() => {
      const current = id();
      return current === undefined || Number.isNaN(current)
        ? undefined
        : `${this.baseUrl}/doctors/${current}/`;
    });
    return mapped(ref, toPublicDoctor);
  }

  serviceResource(slug: () => string | undefined): Loadable<HospitalService> {
    const ref = httpResource<HospitalServiceDto>(() => {
      const current = slug();
      return current === undefined ? undefined : `${this.baseUrl}/services/${current}/`;
    });
    return mapped(ref, toHospitalService);
  }

  slotsResource(request: () => { doctorId: number; date: string } | undefined): Loadable<readonly PublicSlot[]> {
    const ref = httpResource<{ results: readonly PublicSlotDto[] }>(() => {
      const current = request();
      return current === undefined
        ? undefined
        : {
            url: `${this.baseUrl}/doctors/${current.doctorId}/slots/`,
            params: { date: current.date },
            // Slots change by the minute; never serve them from the SSR transfer cache.
            transferCache: false,
          };
    });
    return mapped(ref, (dto) => dto.results.map(toPublicSlot));
  }

  /* ------------------------------------------------------------ writes */

  async book(input: GuestBookingInput): Promise<BookingConfirmation> {
    const dto = await firstValueFrom(
      this.http.post<BookingConfirmationDto>(`${this.baseUrl}/appointments/`, toGuestBookingDto(input), {
        // Field errors are rendered on the form, not as a toast.
        context: authContext({ skipErrorToast: true }),
      }),
    );
    const confirmation = toBookingConfirmation(dto);
    this.lastBookingSignal.set(confirmation);
    return confirmation;
  }

  async lookupBooking(reference: string, phone: string): Promise<BookingConfirmation> {
    const dto = await firstValueFrom(
      this.http.get<BookingConfirmationDto>(`${this.baseUrl}/appointments/lookup/`, {
        params: { reference, phone },
        context: authContext({ skipErrorToast: true }),
      }),
    );
    return toBookingConfirmation(dto);
  }

  async sendContact(input: ContactInput): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.baseUrl}/contact/`, input, {
        context: authContext({ skipErrorToast: true }),
      }),
    );
  }
}
