import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastHostComponent } from './shared/ui/toast-host/toast-host.component';

/**
 * Root component. Deliberately thin: the authenticated frame lives in
 * `ShellComponent`, routed to, so the login and error pages can render
 * full-bleed without it.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHostComponent],
  template: `
    <router-outlet />
    <hms-toast-host />
  `,
})
export class App {}
