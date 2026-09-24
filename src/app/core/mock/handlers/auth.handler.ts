import { db, type MockUserRow } from '../db';
import { detailError, match, ok } from '../mock-utils';
import type { MockHandler, MockRequest } from '../mock-types';

/**
 * Mints tokens that are structurally real JWTs (three base64url segments with a
 * decodable payload) but carry a dummy signature. That matters because
 * `decodeAccessToken` and the expiry check in `AuthService` run against them.
 */

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 24 * 60 * 60;

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (segment === undefined) {
    return null;
  }
  try {
    const normalised = segment.replace(/-/g, '+').replace(/_/g, '/');
    const parsed: unknown = JSON.parse(
      atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, '=')),
    );
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function signToken(userId: number, type: 'access' | 'refresh'): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const ttl = type === 'access' ? ACCESS_TTL_SECONDS : REFRESH_TTL_SECONDS;
  const payload = base64Url(
    JSON.stringify({
      token_type: type,
      exp: Math.floor(Date.now() / 1000) + ttl,
      iat: Math.floor(Date.now() / 1000),
      jti: `${type}-${userId}-${Date.now()}`,
      user_id: userId,
    }),
  );
  return `${header}.${payload}.mock-signature`;
}

function publicUser(row: MockUserRow): Omit<MockUserRow, 'password' | 'is_active'> {
  const { password: _password, is_active: _isActive, ...rest } = row;
  return rest;
}

/** Resolves the caller from the Bearer header, as Django's auth backend would. */
export function currentUser(request: MockRequest): MockUserRow | null {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    return null;
  }
  const payload = decodePayload(header.slice('Bearer '.length));
  if (payload === null || typeof payload['user_id'] !== 'number') {
    return null;
  }
  const exp = payload['exp'];
  if (typeof exp === 'number' && exp * 1000 <= Date.now()) {
    return null;
  }
  return db.users.find((row) => row.id === payload['user_id']) ?? null;
}

export const authHandler: MockHandler = (request) => {
  if (match(request, 'POST', '/token/') !== null) {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const username = typeof body['username'] === 'string' ? body['username'] : '';
    const password = typeof body['password'] === 'string' ? body['password'] : '';

    const row = db.users.find((candidate) => candidate.username === username);
    if (row === undefined || row.password !== password || !row.is_active) {
      // SimpleJWT returns exactly this on a bad credential pair.
      return detailError(401, 'No active account found with the given credentials');
    }

    return ok({ access: signToken(row.id, 'access'), refresh: signToken(row.id, 'refresh') });
  }

  if (match(request, 'POST', '/token/refresh/') !== null) {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const refresh = typeof body['refresh'] === 'string' ? body['refresh'] : '';
    const payload = decodePayload(refresh);

    if (
      payload === null ||
      payload['token_type'] !== 'refresh' ||
      typeof payload['user_id'] !== 'number' ||
      (typeof payload['exp'] === 'number' && payload['exp'] * 1000 <= Date.now())
    ) {
      return detailError(401, 'Token is invalid or expired');
    }

    return ok({ access: signToken(payload['user_id'], 'access') });
  }

  if (match(request, 'POST', '/token/blacklist/') !== null) {
    return ok({});
  }

  if (match(request, 'GET', '/auth/me/') !== null) {
    const row = currentUser(request);
    if (row === null) {
      return detailError(401, 'Given token not valid for any token type');
    }
    return ok(publicUser(row));
  }

  return null;
};
