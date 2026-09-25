import { RenderMode, type ServerRoute } from '@angular/ssr';

/**
 * Public pages render on the server so search engines and link previews see
 * real content. They render per request rather than being prerendered: the
 * language comes from a cookie, and a prerendered page would always be English.
 *
 * Anything behind a login renders on the client only: prerendering it would
 * bake an anonymous view into the HTML.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'about', renderMode: RenderMode.Server },
  { path: 'contact', renderMode: RenderMode.Server },
  { path: 'services', renderMode: RenderMode.Server },
  { path: 'services/:slug', renderMode: RenderMode.Server },
  { path: 'departments', renderMode: RenderMode.Server },
  { path: 'departments/:slug', renderMode: RenderMode.Server },
  { path: 'doctors', renderMode: RenderMode.Server },
  { path: 'doctors/:id', renderMode: RenderMode.Server },
  { path: 'book', renderMode: RenderMode.Client },
  { path: 'book/**', renderMode: RenderMode.Client },
  { path: 'patient/**', renderMode: RenderMode.Client },
  { path: 'patient', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'forbidden', renderMode: RenderMode.Prerender },
  { path: 'app/**', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
