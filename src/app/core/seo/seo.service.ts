import { DOCUMENT, Injectable, RESPONSE_INIT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SITE_CONFIG } from '../config/site-config';
import { I18nService } from '../i18n/i18n.service';

export interface PageMeta {
  readonly title: string;
  readonly description?: string;
  /** Structured data for search engines, e.g. a `Physician` on a doctor page. */
  readonly jsonLd?: Readonly<Record<string, unknown>>;
}

const JSON_LD_ID = 'page-json-ld';

/**
 * Title, description, Open Graph and JSON-LD for public pages. Runs during SSR,
 * which is the point: crawlers and link previews read the server-rendered head.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  set(page: PageMeta): void {
    const siteName = this.i18n.pick(SITE_CONFIG.name);
    const fullTitle = page.title === siteName ? siteName : `${page.title} | ${siteName}`;
    const description = page.description ?? this.i18n.pick(SITE_CONFIG.tagline);

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:site_name', content: siteName });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:locale', content: this.i18n.lang() === 'bn' ? 'bn_BD' : 'en_US' });

    this.setJsonLd(page.jsonLd ?? this.hospitalJsonLd());
  }

  /**
   * Sends a real 404 status when rendering on the server, so search engines
   * drop dead doctor or service URLs instead of indexing an error page as
   * content. No-op in the browser.
   */
  notFound(): void {
    if (this.responseInit !== null) {
      this.responseInit.status = 404;
    }
  }

  /** The site-wide `Hospital` entity; pages without their own schema use this. */
  hospitalJsonLd(): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'Hospital',
      name: SITE_CONFIG.name.en,
      telephone: SITE_CONFIG.hotline,
      email: SITE_CONFIG.email,
      address: { '@type': 'PostalAddress', streetAddress: SITE_CONFIG.address.en, addressCountry: 'BD' },
      openingHours: 'Mo-Su 00:00-23:59',
      medicalSpecialty: ['Cardiology', 'Obstetrics', 'Pediatrics', 'Neurology', 'Dermatology'],
    };
  }

  private setJsonLd(data: Readonly<Record<string, unknown>>): void {
    let script = this.document.getElementById(JSON_LD_ID) as HTMLScriptElement | null;
    if (script === null) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    // `<` is escaped so content can never close the script element early.
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }
}
