import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent } from '../card/card.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

/**
 * Temporary stand-in for a feature that is scaffolded but not yet built.
 * Each build phase replaces one of these with the real screens; the route,
 * guard and lazy chunk are already correct, so only the component changes.
 */
@Component({
  selector: 'hms-feature-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <hms-page-header [heading]="heading()" [description]="description()" />
    <hms-card [padded]="false">
      <hms-empty-state
        title="This module is not built yet"
        description="The route, role guard and lazy chunk are in place. Screens land in a later build phase."
      />
    </hms-card>
  `,
})
export class FeaturePlaceholderComponent {
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
}
