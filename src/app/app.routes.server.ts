import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * The app is auth-gated, so prerendering the shell would bake in an anonymous
 * view. Only the public login page is prerendered; everything behind a guard
 * renders on the client.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'forbidden', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Client },
];
