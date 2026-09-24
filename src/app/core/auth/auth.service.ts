import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { authContext } from '../http/http-context';
import { toApiError, type ApiError } from '../http/api-error';
import { TokenStorageService } from './token-storage.service';
import {
  isTokenExpired,
  toAuthUser,
  type AuthState,
  type AuthTokens,
  type AuthTokensDto,
  type AuthUser,
  type AuthUserDto,
  type LoginCredentials,
  type Role,
} from './auth.model';

/** `refresh` comes back only when SimpleJWT's ROTATE_REFRESH_TOKENS is enabled. */
interface RefreshResponseDto {
  readonly access: string;
  readonly refresh?: string;
}

/**
 * Owns the session. Everything else (interceptor, guards, sidebar) reads from
 * the signals here rather than keeping its own copy of the auth state.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);
  private readonly storage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly state = signal<AuthState>({ status: 'unknown' });
  private readonly loginError = signal<ApiError | null>(null);

  /**
   * Single-flight guard: concurrent 401s from parallel requests must trigger
   * exactly one call to /api/token/refresh/, with everyone awaiting the same promise.
   */
  private refreshInFlight: Promise<AuthTokens | null> | null = null;

  readonly authState = this.state.asReadonly();
  readonly error = this.loginError.asReadonly();

  readonly user = computed<AuthUser | null>(() => {
    const current = this.state();
    return current.status === 'authenticated' ? current.user : null;
  });

  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

  readonly isAuthenticated = computed(() => this.state().status === 'authenticated');

  readonly isAuthenticating = computed(() => this.state().status === 'authenticating');

  /** True until the initial session restore has settled — guards wait on this. */
  readonly isInitialising = computed(() => this.state().status === 'unknown');

  accessToken(): string | null {
    const current = this.state();
    return current.status === 'authenticated' ? current.tokens.access : null;
  }

  refreshToken(): string | null {
    const current = this.state();
    return current.status === 'authenticated' ? current.tokens.refresh : null;
  }

  /**
   * Rehydrates the session from storage on app start. Called once by an
   * APP_INITIALIZER-style provider so guards never run against 'unknown'.
   */
  async restoreSession(): Promise<void> {
    if (this.state().status !== 'unknown') {
      return;
    }

    const stored = this.storage.read();
    if (stored === null) {
      this.state.set({ status: 'anonymous' });
      return;
    }

    let tokens = stored;
    if (isTokenExpired(tokens.access)) {
      const renewed = await this.requestRefresh(tokens.refresh);
      if (renewed === null) {
        this.clearSession();
        return;
      }
      tokens = renewed;
    }

    try {
      const user = await this.fetchCurrentUser(tokens.access);
      this.commitSession(tokens, user);
    } catch {
      this.clearSession();
    }
  }

  async login(credentials: LoginCredentials): Promise<boolean> {
    this.loginError.set(null);
    this.state.set({ status: 'authenticating' });

    try {
      const dto = await firstValueFrom(
        this.http.post<AuthTokensDto>(`${this.config.apiBaseUrl}/token/`, credentials, {
          context: authContext({ skipAuth: true, skipErrorToast: true }),
        }),
      );
      const tokens: AuthTokens = { access: dto.access, refresh: dto.refresh };
      const user = await this.fetchCurrentUser(tokens.access);
      this.commitSession(tokens, user);
      return true;
    } catch (error: unknown) {
      this.loginError.set(toApiError(error));
      this.state.set({ status: 'anonymous' });
      return false;
    }
  }

  async logout(redirectTo = '/auth/login'): Promise<void> {
    const refresh = this.refreshToken();
    if (refresh !== null) {
      try {
        // SimpleJWT blacklist endpoint; failure here must not block sign-out.
        await firstValueFrom(
          this.http.post(
            `${this.config.apiBaseUrl}/token/blacklist/`,
            { refresh },
            { context: authContext({ skipAuth: true, skipErrorToast: true }) },
          ),
        );
      } catch {
        // Ignored on purpose — the local session is cleared regardless.
      }
    }
    this.clearSession();
    await this.router.navigateByUrl(redirectTo);
  }

  /**
   * Refreshes the access token, collapsing concurrent callers onto one request.
   * Returns null when the refresh token is dead, in which case the session is cleared.
   */
  refreshSession(): Promise<AuthTokens | null> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }

    const refresh = this.refreshToken();
    if (refresh === null) {
      this.clearSession();
      return Promise.resolve(null);
    }

    this.refreshInFlight = this.requestRefresh(refresh)
      .then((tokens) => {
        if (tokens === null) {
          this.clearSession();
          return null;
        }
        const current = this.state();
        if (current.status === 'authenticated') {
          this.state.set({ status: 'authenticated', user: current.user, tokens });
          this.storage.write(tokens);
        }
        return tokens;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });

    return this.refreshInFlight;
  }

  private async requestRefresh(refresh: string): Promise<AuthTokens | null> {
    try {
      const dto = await firstValueFrom(
        this.http.post<RefreshResponseDto>(
          `${this.config.apiBaseUrl}/token/refresh/`,
          { refresh },
          { context: authContext({ skipAuth: true, skipErrorToast: true, skipLoading: true }) },
        ),
      );
      // SimpleJWT only returns `refresh` when ROTATE_REFRESH_TOKENS is on.
      return { access: dto.access, refresh: dto.refresh ?? refresh };
    } catch {
      return null;
    }
  }

  private async fetchCurrentUser(access: string): Promise<AuthUser> {
    const dto = await firstValueFrom(
      this.http.get<AuthUserDto>(`${this.config.apiBaseUrl}/auth/me/`, {
        headers: { Authorization: `Bearer ${access}` },
        context: authContext({ skipAuth: true, skipErrorToast: true }),
      }),
    );
    return toAuthUser(dto);
  }

  private commitSession(tokens: AuthTokens, user: AuthUser): void {
    this.storage.write(tokens);
    this.state.set({ status: 'authenticated', user, tokens });
  }

  private clearSession(): void {
    this.storage.clear();
    this.state.set({ status: 'anonymous' });
  }
}
