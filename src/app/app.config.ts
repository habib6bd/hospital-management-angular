import {
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
  type ApplicationConfig,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { provideAppConfig } from './core/config/app-config';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/services/theme.service';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { mockApiInterceptor } from './core/interceptors/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppConfig(),

    provideRouter(
      routes,
      // Route `data` is bound straight to component `input()`s (see ErrorPageComponent).
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),

    provideHttpClient(
      // `withFetch()` keeps HTTP working under SSR without Zone.js patching.
      withFetch(),
      withInterceptors([
        // Order is deliberate. Requests travel down this list and responses back
        // up it, so:
        //  - errorInterceptor is outermost and sees the final, unrecovered error;
        //  - authInterceptor sits inside it, so it gets the raw 401 and can
        //    refresh + replay before the error ever surfaces as a toast;
        //  - loading wraps only the real network leg;
        //  - mockApi is innermost and stands in for the server itself.
        errorInterceptor,
        authInterceptor,
        loadingInterceptor,
        mockApiInterceptor,
      ]),
    ),

    provideClientHydration(),

    // Restore the session before the first navigation so guards never observe
    // the 'unknown' state and bounce an already-signed-in user to login.
    provideAppInitializer(() => {
      inject(ThemeService);
      return inject(AuthService).restoreSession();
    }),
  ],
};
