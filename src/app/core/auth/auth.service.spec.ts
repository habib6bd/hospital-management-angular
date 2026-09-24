import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { provideAppConfig } from '../config/app-config';
import { mockApiInterceptor } from '../interceptors/mock-api.interceptor';
import { authInterceptor } from '../interceptors/auth.interceptor';

/**
 * Exercises the real interceptor chain against the mock backend, so these cover
 * token minting, the Bearer header and the /auth/me round-trip — not just the
 * service in isolation.
 */
function configure(): AuthService {
  TestBed.configureTestingModule({
    providers: [
      // `logout()` navigates, so the redirect target has to resolve.
      provideRouter([{ path: 'auth/login', children: [] }]),
      // Zero latency keeps the suite fast; the chain is otherwise identical.
      provideAppConfig({ mockLatencyMs: [0, 0] }),
      provideHttpClient(withInterceptors([authInterceptor, mockApiInterceptor])),
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in the unknown state until the session is restored', () => {
    const auth = configure();
    expect(auth.isInitialising()).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('settles to anonymous when nothing is stored', async () => {
    const auth = configure();
    await auth.restoreSession();
    expect(auth.authState().status).toBe('anonymous');
  });

  it('signs in with valid credentials and exposes the decoded user', async () => {
    const auth = configure();
    const ok = await auth.login({ username: 'doctor', password: 'demo1234' });

    expect(ok).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.role()).toBe('doctor');
    expect(auth.user()?.fullName).toBe('Imran Hossain');
    expect(auth.accessToken()).not.toBeNull();
  });

  it('rejects bad credentials and surfaces a normalised error', async () => {
    const auth = configure();
    const ok = await auth.login({ username: 'doctor', password: 'wrong' });

    expect(ok).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.error()?.status).toBe(401);
    expect(auth.error()?.message).toContain('No active account');
  });

  it('persists the token pair so the next session can be restored', async () => {
    const auth = configure();
    await auth.login({ username: 'admin', password: 'demo1234' });

    const stored = TestBed.inject(TokenStorageService).read();
    expect(stored).not.toBeNull();
    expect(stored?.access).toBeTruthy();
    expect(stored?.refresh).toBeTruthy();
  });

  it('restores a session from stored tokens without re-authenticating', async () => {
    const first = configure();
    await first.login({ username: 'pharmacy', password: 'demo1234' });
    TestBed.resetTestingModule();

    const second = configure();
    await second.restoreSession();

    expect(second.isAuthenticated()).toBe(true);
    expect(second.role()).toBe('pharmacist');
  });

  it('collapses concurrent refreshes onto a single request', async () => {
    const auth = configure();
    await auth.login({ username: 'nurse', password: 'demo1234' });
    const before = auth.accessToken();

    const [a, b, c] = await Promise.all([
      auth.refreshSession(),
      auth.refreshSession(),
      auth.refreshSession(),
    ]);

    // Same promise resolved for all three callers, so all three see one token.
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(auth.accessToken()).not.toBe(before);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears the session when the refresh token is not valid', async () => {
    const auth = configure();
    await auth.login({ username: 'admin', password: 'demo1234' });

    TestBed.inject(TokenStorageService).write({ access: 'bad.token.x', refresh: 'bad.token.x' });
    TestBed.resetTestingModule();

    const restored = configure();
    await restored.restoreSession();

    expect(restored.isAuthenticated()).toBe(false);
    expect(restored.authState().status).toBe('anonymous');
  });

  it('logs out, clearing both in-memory and stored state', async () => {
    const auth = configure();
    await auth.login({ username: 'lab', password: 'demo1234' });
    await auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(TestBed.inject(TokenStorageService).read()).toBeNull();
  });
});
