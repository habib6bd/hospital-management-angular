import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { APP_CONFIG } from '../../../core/config/app-config';
import { authContext } from '../../../core/http/http-context';
import { toQueryParams, type PaginatedDto } from '../../../core/http/paginated';
import { todayIso } from '../../appointments/appointment.service';
import { toAppointment, type AppointmentDto } from '../../../shared/models/appointment.dto';
import { CardComponent } from '../../../shared/ui/card/card.component';
import { SkeletonComponent } from '../../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state/empty-state.component';
import { BarChartComponent } from '../../../shared/ui/chart/bar-chart.component';
import { StatTileComponent } from './stat-tile.component';
import { WIDGET_LINK_CLASS } from './widget-link';
import { countVisitsByDay, dayLabel, trailingDays } from '../dashboard-data';

const WINDOW_DAYS = 7;

@Component({
  selector: 'hms-patient-inflow-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CardComponent, SkeletonComponent, EmptyStateComponent, BarChartComponent, StatTileComponent],
  template: `
    <hms-card heading="Patient inflow" subheading="OPD visits, last 7 days">
      <a card-actions routerLink="/app/appointments" [class]="linkClass">Appointments</a>

      @if (resource.isLoading() && !resource.hasValue()) {
        <hms-skeleton [lines]="6" [height]="20" label="Loading patient inflow" />
      } @else if (resource.error()) {
        <hms-empty-state title="Inflow unavailable" description="Try reloading the page." />
      } @else {
        <div class="mb-4 grid grid-cols-3 gap-2">
          <hms-stat-tile label="Today" [value]="'' + today()" />
          <hms-stat-tile label="Last 7 days" [value]="'' + total()" />
          <hms-stat-tile label="Daily average" [value]="average()" />
        </div>
        <hms-bar-chart
          [labels]="labels()"
          [values]="counts()"
          seriesLabel="Visits"
          ariaLabel="OPD visits per day over the last 7 days"
        />
      }
    </hms-card>
  `,
})
export class PatientInflowWidgetComponent {
  private readonly config = inject(APP_CONFIG);
  protected readonly linkClass = WIDGET_LINK_CLASS;

  private readonly days = trailingDays(todayIso(), WINDOW_DAYS);

  protected readonly resource = httpResource<PaginatedDto<AppointmentDto>>(() => ({
    url: `${this.config.apiBaseUrl}/appointments/`,
    params: toQueryParams({
      date_after: this.days[0],
      date_before: this.days[this.days.length - 1],
      // A week of OPD visits fits comfortably; a smaller page would undercount.
      page_size: 500,
    }),
    context: authContext({ skipLoading: true }),
  }));

  protected readonly labels = computed(() => this.days.map(dayLabel));

  protected readonly counts = computed(() =>
    countVisitsByDay(this.resource.value()?.results.map(toAppointment) ?? [], this.days),
  );

  protected readonly total = computed(() => this.counts().reduce((sum, count) => sum + count, 0));
  protected readonly today = computed(() => this.counts()[this.counts().length - 1] ?? 0);
  protected readonly average = computed(() => (this.total() / WINDOW_DAYS).toFixed(1));
}
