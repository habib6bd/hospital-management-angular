import type { Localized } from '../i18n/i18n.model';

/**
 * Everything that brands the public website. Rebranding the site for a real
 * hospital means editing this file (and the images in `public/images`) only.
 */
export interface SiteConfig {
  readonly name: Localized;
  readonly shortName: string;
  readonly tagline: Localized;
  readonly hotline: string;
  readonly emergency: string;
  readonly whatsapp: string;
  readonly email: string;
  readonly address: Localized;
  /** Google Maps "embed" URL for the contact page and footer. */
  readonly mapEmbedUrl: string;
  readonly mapLink: string;
  readonly established: number;
  readonly visitingHours: Localized;
  readonly opdHours: Localized;
  readonly social: readonly { readonly label: string; readonly url: string; readonly icon: SocialIcon }[];
}

export type SocialIcon = 'facebook' | 'youtube' | 'linkedin';

export const SITE_CONFIG: SiteConfig = {
  name: { en: 'CareWell General Hospital', bn: 'কেয়ারওয়েল জেনারেল হাসপাতাল' },
  shortName: 'CareWell',
  tagline: {
    en: 'Compassionate care, modern medicine',
    bn: 'সহমর্মী সেবা, আধুনিক চিকিৎসা',
  },
  hotline: '10666',
  emergency: '+8801700000000',
  whatsapp: '8801700000000',
  email: 'info@carewell.example',
  address: {
    en: 'House 12, Road 5, Dhanmondi, Dhaka 1205',
    bn: 'বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা ১২০৫',
  },
  mapEmbedUrl:
    'https://www.google.com/maps?q=Dhanmondi%2C%20Dhaka&output=embed',
  mapLink: 'https://maps.google.com/?q=Dhanmondi,Dhaka',
  established: 2004,
  visitingHours: { en: 'Visiting hours: 11 AM – 1 PM, 5 PM – 7 PM', bn: 'দর্শনার্থীর সময়: সকাল ১১টা – দুপুর ১টা, বিকাল ৫টা – সন্ধ্যা ৭টা' },
  opdHours: { en: 'OPD: Sat – Thu, 9 AM – 9 PM', bn: 'বহির্বিভাগ: শনি – বৃহস্পতি, সকাল ৯টা – রাত ৯টা' },
  social: [
    { label: 'Facebook', url: 'https://facebook.com', icon: 'facebook' },
    { label: 'YouTube', url: 'https://youtube.com', icon: 'youtube' },
    { label: 'LinkedIn', url: 'https://linkedin.com', icon: 'linkedin' },
  ],
};
