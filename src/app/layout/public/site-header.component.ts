import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SITE_CONFIG } from '../../core/config/site-config';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ROLE_LABELS } from '../../core/auth/auth.model';
import { I18N_PIPES } from '../../core/i18n/i18n.pipes';
import type { TranslationKey } from '../../core/i18n/dictionaries/en';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { SiteButtonDirective } from '../../features/site/ui/site-button.directive';
import { LangToggleComponent } from './lang-toggle.component';
import { SiteLogoComponent } from './site-logo.component';

interface SiteNavItem {
  readonly key: TranslationKey;
  readonly route: string;
  readonly exact: boolean;
}

const NAV: readonly SiteNavItem[] = [
  { key: 'nav.home', route: '/', exact: true },
  { key: 'nav.doctors', route: '/doctors', exact: false },
  { key: 'nav.departments', route: '/departments', exact: false },
  { key: 'nav.services', route: '/services', exact: false },
  { key: 'nav.about', route: '/about', exact: true },
  { key: 'nav.contact', route: '/contact', exact: true },
];

@Component({
  selector: 'site-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    IconComponent,
    SiteButtonDirective,
    LangToggleComponent,
    SiteLogoComponent,
    ...I18N_PIPES,
  ],
  host: {
    class: 'contents',
    '(window:scroll)': 'onScroll()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'userMenuOpen.set(false)',
  },
  template: `
    <!-- Utility bar: contact first, because on a hospital site that is what
         most visitors came for. -->
    <div class="no-print hidden bg-brand-950 text-white/80 md:block">
      <div class="mx-auto flex h-10 max-w-7xl items-center justify-between gap-6 px-4 text-[13px] sm:px-6 lg:px-8">
        <div class="flex items-center gap-6">
          <a [href]="'tel:' + site.emergency" class="flex items-center gap-2 font-medium text-white hover:text-white/90">
            <span class="relative flex size-2" aria-hidden="true">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-emergency opacity-75"></span>
              <span class="relative inline-flex size-2 rounded-full bg-emergency"></span>
            </span>
            {{ 'top.emergency' | t }} {{ site.emergency | num }}
          </a>
          <a [href]="'tel:' + site.hotline" class="flex items-center gap-1.5 hover:text-white">
            <hms-icon name="phone" [size]="14" />
            {{ 'top.hotline' | t }} {{ site.hotline | num }}
          </a>
          <a [href]="'mailto:' + site.email" class="hidden items-center gap-1.5 hover:text-white lg:flex">
            <hms-icon name="mail" [size]="14" />
            {{ site.email }}
          </a>
        </div>
        <div class="flex items-center gap-5">
          <span class="hidden items-center gap-1.5 xl:flex">
            <hms-icon name="clock" [size]="14" />
            {{ site.opdHours | loc }}
          </span>
          <site-lang-toggle tone="dark" />
        </div>
      </div>
    </div>

    <header
      class="no-print sticky top-0 z-40 transition-[background-color,box-shadow] duration-300"
      [class]="scrolled()
        ? 'bg-surface-raised/90 shadow-[0_4px_24px_-8px] shadow-slate-900/10 backdrop-blur-lg'
        : 'bg-surface-raised'"
    >
      <div class="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:h-20 lg:px-8">
        <site-logo />

        <nav class="mx-auto hidden lg:block" [attr.aria-label]="'nav.main' | t">
          <ul class="flex items-center gap-1 xl:gap-2">
            @for (item of nav; track item.route) {
              <li>
                <a
                  [routerLink]="item.route"
                  routerLinkActive="text-brand-600! after:scale-x-100 dark:text-brand-400!"
                  [routerLinkActiveOptions]="{ exact: item.exact }"
                  ariaCurrentWhenActive="page"
                  class="relative px-3 py-2 text-[15px] font-medium text-slate-700 transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-600 after:transition-transform after:duration-300 hover:text-brand-600 hover:after:scale-x-100 dark:text-surface-fg"
                >
                  {{ item.key | t }}
                </a>
              </li>
            }
          </ul>
        </nav>

        <div class="ml-auto flex items-center gap-2 lg:ml-0">
          @if (auth.user(); as user) {
            <!-- Signed in: name, role, dashboard and logout. -->
            <div class="relative hidden sm:block" #userMenu>
              <button
                type="button"
                class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 ring-1 ring-slate-200 transition hover:ring-brand-300 dark:ring-white/15"
                aria-haspopup="menu"
                [attr.aria-expanded]="userMenuOpen()"
                (click)="userMenuOpen.set(!userMenuOpen())"
              >
                <span class="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{{ initial() }}</span>
                <span class="max-w-[8rem] truncate text-sm font-semibold text-accent-950 dark:text-white">{{ user.firstName || user.username }}</span>
                <hms-icon name="chevron-down" [size]="16" class="text-slate-400 transition-transform" [class.rotate-180]="userMenuOpen()" />
              </button>
              @if (userMenuOpen()) {
                <div class="absolute right-0 top-full mt-3 w-64 origin-top-right overflow-hidden rounded-2xl bg-surface-raised shadow-lift ring-1 ring-slate-900/5 dark:ring-white/10" role="menu">
                  <div class="border-b border-slate-100 px-4 py-3.5 dark:border-white/10">
                    <p class="truncate text-sm font-bold text-accent-950 dark:text-white">{{ user.fullName }}</p>
                    <p class="mt-0.5 text-xs text-slate-500 dark:text-surface-fg-muted">{{ roleLabel() }}</p>
                  </div>
                  <div class="p-1.5">
                    <a
                      [routerLink]="permissions.landingRoute()"
                      role="menuitem"
                      class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-tint hover:text-brand-700 dark:text-surface-fg"
                    >
                      <hms-icon name="dashboard" [size]="18" class="text-brand-500" />
                      {{ 'nav.dashboard' | t }}
                    </a>
                    <button
                      type="button"
                      role="menuitem"
                      class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-emergency-soft hover:text-emergency-strong dark:text-surface-fg"
                      (click)="logout()"
                    >
                      <hms-icon name="logout" [size]="18" class="text-slate-400" />
                      {{ 'nav.logout' | t }}
                    </button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/login" siteBtn="outline" size="sm" class="hidden! sm:inline-flex!">
              <hms-icon name="user" [size]="16" />
              {{ 'nav.login' | t }}
            </a>
          }
          <a routerLink="/book" siteBtn size="sm" class="hidden! md:inline-flex!">
            <hms-icon name="calendar" [size]="16" />
            {{ 'cta.bookAppointment' | t }}
          </a>
          <button
            type="button"
            class="flex size-11 items-center justify-center rounded-full text-accent-950 ring-1 ring-slate-200 hover:bg-tint lg:hidden dark:text-white dark:ring-white/15"
            [attr.aria-label]="'nav.openMenu' | t"
            aria-haspopup="dialog"
            [attr.aria-expanded]="menuOpen()"
            (click)="openMenu()"
          >
            <hms-icon name="menu" [size]="22" />
          </button>
        </div>
      </div>
    </header>

    <!-- A native modal <dialog> gives us focus trapping, Escape-to-close and an
         inert page behind it without a dependency. -->
    <dialog
      #drawer
      class="m-0 ml-auto h-dvh max-h-none w-[min(22rem,100vw)] max-w-none bg-surface-raised p-0 text-surface-fg shadow-2xl backdrop:bg-brand-950/50 backdrop:backdrop-blur-sm"
      [attr.aria-label]="'nav.menu' | t"
      (close)="menuOpen.set(false)"
      (click)="onDialogClick($event)"
    >
      <div class="flex h-full flex-col">
        <div class="flex h-18 items-center justify-between border-b border-slate-100 px-4 dark:border-white/10">
          <site-logo [compact]="true" />
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-full hover:bg-tint"
            [attr.aria-label]="'nav.closeMenu' | t"
            (click)="closeMenu()"
          >
            <hms-icon name="x" [size]="22" />
          </button>
        </div>

        @if (auth.user(); as user) {
          <div class="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-tint p-3">
            <span class="flex size-11 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{{ initial() }}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-accent-950 dark:text-white">{{ user.fullName }}</p>
              <p class="text-xs text-slate-500 dark:text-surface-fg-muted">{{ roleLabel() }}</p>
            </div>
          </div>
        }

        <nav class="flex-1 overflow-y-auto px-3 py-4" [attr.aria-label]="'nav.main' | t">
          <ul class="flex flex-col gap-0.5">
            @for (item of nav; track item.route) {
              <li>
                <a
                  [routerLink]="item.route"
                  routerLinkActive="bg-brand-50 text-brand-700! dark:bg-brand-950 dark:text-brand-300!"
                  [routerLinkActiveOptions]="{ exact: item.exact }"
                  ariaCurrentWhenActive="page"
                  class="flex items-center justify-between rounded-xl px-4 py-3 text-base font-medium text-slate-700 hover:bg-tint dark:text-surface-fg"
                >
                  {{ item.key | t }}
                  <hms-icon name="chevron-right" [size]="18" class="opacity-40" />
                </a>
              </li>
            }
          </ul>

          <div class="mt-6 flex flex-col gap-2 px-1">
            <a routerLink="/book" siteBtn size="lg" class="w-full">
              <hms-icon name="calendar" [size]="18" />
              {{ 'cta.bookAppointment' | t }}
            </a>
            @if (auth.isAuthenticated()) {
              <a [routerLink]="permissions.landingRoute()" siteBtn="outline" size="lg" class="w-full">
                <hms-icon name="dashboard" [size]="18" />
                {{ 'nav.dashboard' | t }}
              </a>
              <button type="button" siteBtn="ghost" size="lg" class="w-full" (click)="logout()">
                <hms-icon name="logout" [size]="18" />
                {{ 'nav.logout' | t }}
              </button>
            } @else {
              <a routerLink="/login" siteBtn="outline" size="lg" class="w-full">
                <hms-icon name="user" [size]="18" />
                {{ 'nav.login' | t }}
              </a>
            }
          </div>
        </nav>

        <div class="space-y-3 border-t border-slate-100 px-5 py-4 text-sm dark:border-white/10">
          <a [href]="'tel:' + site.emergency" class="flex items-center gap-3 font-semibold text-emergency">
            <span class="flex size-9 items-center justify-center rounded-full bg-emergency-soft">
              <hms-icon name="siren" [size]="18" />
            </span>
            {{ 'top.emergency' | t }}: {{ site.emergency | num }}
          </a>
          <site-lang-toggle class="block pt-1" />
        </div>
      </div>
    </dialog>
  `,
})
export class SiteHeaderComponent {
  protected readonly auth = inject(AuthService);
  protected readonly permissions = inject(PermissionService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly site = SITE_CONFIG;
  protected readonly nav = NAV;
  protected readonly scrolled = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  protected readonly initial = computed(() => {
    const user = this.auth.user();
    return (user?.firstName || user?.username || '?').charAt(0).toUpperCase();
  });

  protected readonly roleLabel = computed(() => {
    const role = this.auth.role();
    return role === null ? '' : ROLE_LABELS[role];
  });

  private readonly drawer = viewChild.required<ElementRef<HTMLDialogElement>>('drawer');
  private readonly userMenu = viewChild<ElementRef<HTMLElement>>('userMenu');

  constructor() {
    // Any navigation — including from a link inside a menu — closes the menus.
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        this.closeMenu();
        this.userMenuOpen.set(false);
      });
  }

  protected onScroll(): void {
    if (this.isBrowser) {
      this.scrolled.set(window.scrollY > 8);
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    const menu = this.userMenu()?.nativeElement;
    if (this.userMenuOpen() && menu !== undefined && !menu.contains(event.target as Node)) {
      this.userMenuOpen.set(false);
    }
  }

  protected async logout(): Promise<void> {
    this.userMenuOpen.set(false);
    this.closeMenu();
    await this.auth.logout('/');
  }

  protected openMenu(): void {
    this.drawer().nativeElement.showModal();
    this.menuOpen.set(true);
  }

  protected closeMenu(): void {
    const dialog = this.drawer().nativeElement;
    if (dialog.open) {
      dialog.close();
    }
  }

  /** A click on the backdrop lands on the <dialog> itself, not its content. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.drawer().nativeElement) {
      this.closeMenu();
    }
  }
}
