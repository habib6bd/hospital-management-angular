/** Roles mirror Django group names, so they stay snake_case on the wire. */
export const ROLES = [
  'admin',
  'doctor',
  'nurse',
  'receptionist',
  'lab_technician',
  'pharmacist',
  'patient',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
  lab_technician: 'Lab Technician',
  pharmacist: 'Pharmacist',
  patient: 'Patient',
};

/** SimpleJWT token pair. */
export interface AuthTokens {
  readonly access: string;
  readonly refresh: string;
}

export interface AuthTokensDto {
  readonly access: string;
  readonly refresh: string;
}

export interface AuthUserDto {
  readonly id: number;
  readonly username: string;
  readonly email: string;
  readonly first_name: string;
  readonly last_name: string;
  readonly role: string;
  readonly staff_id: string | null;
  /** Present only for role === 'patient'; links the account to a patient record. */
  readonly patient_id: number | null;
  /** Present only for role === 'doctor'; links the account to a doctor record. */
  readonly doctor_id: number | null;
  readonly avatar_url: string | null;
}

export interface AuthUser {
  readonly id: number;
  readonly username: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly role: Role;
  readonly staffId: string | null;
  readonly patientId: number | null;
  readonly doctorId: number | null;
  readonly avatarUrl: string | null;
}

export function toAuthUser(dto: AuthUserDto): AuthUser {
  const fullName = [dto.first_name, dto.last_name].filter(Boolean).join(' ').trim();
  return {
    id: dto.id,
    username: dto.username,
    email: dto.email,
    firstName: dto.first_name,
    lastName: dto.last_name,
    fullName: fullName === '' ? dto.username : fullName,
    role: isRole(dto.role) ? dto.role : 'patient',
    staffId: dto.staff_id,
    patientId: dto.patient_id,
    doctorId: dto.doctor_id ?? null,
    avatarUrl: dto.avatar_url,
  };
}

export interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * Auth state as a discriminated union so impossible combinations
 * (e.g. authenticated with no user) cannot be represented.
 */
export type AuthState =
  | { readonly status: 'unknown' }
  | { readonly status: 'anonymous' }
  | { readonly status: 'authenticating' }
  | { readonly status: 'authenticated'; readonly user: AuthUser; readonly tokens: AuthTokens };

/** Minimal SimpleJWT access-token payload we rely on. */
export interface AccessTokenPayload {
  readonly exp: number;
  readonly user_id: number;
  readonly token_type: string;
}

/** Decodes a JWT payload without verifying it — the server is the authority. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }
  const payload = segments[1];
  if (payload === undefined) {
    return null;
  }
  try {
    const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '='));
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object') {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record['exp'] !== 'number') {
      return null;
    }
    return {
      exp: record['exp'],
      user_id: typeof record['user_id'] === 'number' ? record['user_id'] : 0,
      token_type: typeof record['token_type'] === 'string' ? record['token_type'] : 'access',
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeAccessToken(token);
  if (payload === null) {
    return true;
  }
  return payload.exp * 1000 - skewSeconds * 1000 <= Date.now();
}
