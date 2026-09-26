import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionService } from '../../core/auth/permission.service';
import type { DashboardWidgetKey } from '../../core/auth/permission.model';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { RevenueWidgetComponent } from './widgets/revenue-widget.component';
import { InventoryAlertsWidgetComponent } from './widgets/inventory-alerts-widget.component';
import { BedOccupancyWidgetComponent } from './widgets/bed-occupancy-widget.component';
import { OpdQueueWidgetComponent } from './widgets/opd-queue-widget.component';
import { PendingLabWidgetComponent } from './widgets/pending-lab-widget.component';
import { PatientInflowWidgetComponent } from './widgets/patient-inflow-widget.component';
import { MyAppointmentsWidgetComponent } from './widgets/my-appointments-widget.component';

/** Chart widgets need the width; everything else fits a single column. */
const WIDE_WIDGETS: ReadonlySet<DashboardWidgetKey> = new Set(['patient-inflow', 'revenue']);

/**
 * The widget list comes from the role strategy, so this page never checks a
 * role itself. Each widget injects its own service only once rendered, which
 * means a role never requests data it has no permission to read.
 */
@Component({
  selector: 'hms-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    EmptyStateComponent,
    RevenueWidgetComponent,
    InventoryAlertsWidgetComponent,
    BedOccupancyWidgetComponent,
    OpdQueueWidgetComponent,
    PendingLabWidgetComponent,
    PatientInflowWidgetComponent,
    MyAppointmentsWidgetComponent,
  ],
  template: `
    <hms-page-header [heading]="greeting()" [description]="today" />

    @if (widgets().length === 0) {
      <hms-empty-state title="Nothing to show yet" description="Your role has no dashboard widgets." />
    } @else {
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (key of widgets(); track key) {
          <div [class]="isWide(key) ? 'min-w-0 md:col-span-2' : 'min-w-0'">
            @switch (key) {
              @case ('patient-inflow') { <hms-patient-inflow-widget /> }
              @case ('revenue') { <hms-revenue-widget /> }
              @case ('bed-occupancy') { <hms-bed-occupancy-widget /> }
              @case ('inventory-alerts') { <hms-inventory-alerts-widget /> }
              @case ('opd-queue') { <hms-opd-queue-widget /> }
              @case ('pending-lab-orders') { <hms-pending-lab-widget /> }
              @case ('my-appointments') { <hms-my-appointments-widget /> }
            }
          </div>
        }
      </div>
    }
  `,
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  protected readonly widgets = inject(PermissionService).dashboardWidgets;

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = this.auth.user()?.firstName;
    return name ? `${part}, ${name}` : part;
  });

  protected readonly today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  protected isWide(key: DashboardWidgetKey): boolean {
    return WIDE_WIDGETS.has(key);
  }
}
