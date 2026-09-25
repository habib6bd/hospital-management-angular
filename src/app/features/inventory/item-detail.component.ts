import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryService } from './inventory.service';
import { PermissionService } from '../../core/auth/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { CardComponent } from '../../shared/ui/card/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { BadgeComponent } from '../../shared/ui/badge/badge.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state/empty-state.component';
import { StockMovementDialogComponent } from './stock-movement-dialog.component';
import { BdtPipe, HmsDatePipe, RelativeTimePipe } from '../../shared/pipes/hms-pipes';
import {
  ITEM_CATEGORY_LABELS,
  MOVEMENT_LABELS,
  STOCK_STATUS_LABELS,
  daysUntil,
  stockStatus,
  stockStatusTone,
  type Batch,
  type MovementType,
} from '../../shared/models/inventory.model';

@Component({
  selector: 'hms-item-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    CardComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
    StockMovementDialogComponent,
    BdtPipe,
    HmsDatePipe,
    RelativeTimePipe,
  ],
  template: `
    @if (inventory.isDetailLoading() && item() === undefined) {
      <hms-card><hms-skeleton [lines]="6" [height]="16" label="Loading item" /></hms-card>
    } @else if (item(); as record) {
      <hms-page-header [heading]="record.name" [description]="record.code + ' · ' + categoryLabel()">
        @if (canManage()) {
          <hms-button variant="secondary" [routerLink]="['/app/inventory', record.id, 'edit']">
            Edit
          </hms-button>
          <hms-button (pressed)="dialogOpen.set(true)">Record movement</hms-button>
        }
      </hms-page-header>

      <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">In stock</p>
          <p class="mt-1 text-2xl font-semibold text-surface-fg">
            {{ record.quantityInStock }}
            <span class="text-sm font-normal text-surface-fg-muted">{{ record.unit }}</span>
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Reorder level</p>
          <p class="mt-1 text-2xl font-semibold text-surface-fg">{{ record.reorderLevel }}</p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Stock value</p>
          <p class="mt-1 text-2xl font-semibold text-surface-fg">
            {{ record.quantityInStock * record.unitPrice | bdt }}
          </p>
        </div>
        <div class="rounded-card bg-surface-raised p-4 ring-1 ring-surface-border ring-inset">
          <p class="text-xs text-surface-fg-muted">Status</p>
          <p class="mt-2">
            <hms-badge [tone]="statusTone()">{{ statusLabel() }}</hms-badge>
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <hms-card heading="Batches" subheading="Ordered by expiry — stock is issued first-expiry-first-out." [padded]="false">
          @if (inventory.isBatchesLoading()) {
            <div class="p-5"><hms-skeleton [lines]="4" [height]="14" /></div>
          } @else if (inventory.batches().length === 0) {
            <hms-empty-state
              title="No batches"
              description="This item is not batch-tracked, or has no stock on hand."
            />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (batch of inventory.batches(); track batch.id) {
                <li class="flex items-center gap-3 px-5 py-3">
                  <div class="min-w-0 flex-1">
                    <p class="font-mono text-sm text-surface-fg">{{ batch.batchNumber }}</p>
                    <p class="text-xs text-surface-fg-muted">
                      {{ batch.quantity }} {{ record.unit }} · received
                      {{ batch.receivedAt | hmsDate }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs" [class]="batchExpiryClass(batch)">
                      {{ batch.expiryDate | hmsDate }}
                    </p>
                    <p class="text-[11px] text-surface-fg-muted">{{ batchExpiryText(batch) }}</p>
                  </div>
                </li>
              }
            </ul>
          }
        </hms-card>

        <hms-card heading="Stock ledger" subheading="Every movement, with the resulting balance." [padded]="false">
          @if (inventory.isLedgerLoading()) {
            <div class="p-5"><hms-skeleton [lines]="4" [height]="14" /></div>
          } @else if (inventory.ledger().length === 0) {
            <hms-empty-state title="No movements recorded" [description]="null" />
          } @else {
            <ul role="list" class="divide-y divide-surface-border">
              @for (movement of inventory.ledger(); track movement.id) {
                <li class="flex items-center gap-3 px-5 py-3">
                  <hms-badge [tone]="movementTone(movement.type)" [dot]="false">
                    {{ movementLabel(movement.type) }}
                  </hms-badge>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-surface-fg">
                      <span [class]="movement.type === 'stock_in' ? 'text-status-ready-strong' : 'text-status-critical-strong'">
                        {{ movement.type === 'stock_in' ? '+' : '−' }}{{ movement.quantity }}
                      </span>
                      {{ record.unit }}
                    </p>
                    <p class="truncate text-xs text-surface-fg-muted">
                      {{ movement.reason || '—' }} · {{ movement.performedBy }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs font-medium text-surface-fg">
                      balance {{ movement.balanceAfter }}
                    </p>
                    <p class="text-[11px] text-surface-fg-muted">
                      {{ movement.occurredAt | relativeTime }}
                    </p>
                  </div>
                </li>
              }
            </ul>
          }
        </hms-card>
      </div>

      @if (dialogOpen()) {
        <hms-stock-movement-dialog
          [item]="record"
          (closed)="dialogOpen.set(false)"
          (completed)="onMovementRecorded($event)"
        />
      }
    } @else {
      <hms-card>
        <hms-empty-state title="Item not found" description="It may have been removed." />
      </hms-card>
    }
  `,
})
export class ItemDetailComponent {
  protected readonly inventory = inject(InventoryService);
  private readonly permissions = inject(PermissionService);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();

  protected readonly item = this.inventory.selectedItem;
  protected readonly canManage = this.permissions.hasPermission('inventory.manage');
  protected readonly dialogOpen = signal(false);

  constructor() {
    effect(() => {
      const parsed = Number(this.id());
      this.inventory.select(Number.isFinite(parsed) ? parsed : null);
    });
  }

  protected readonly categoryLabel = computed(() => {
    const record = this.item();
    return record === undefined ? '' : ITEM_CATEGORY_LABELS[record.category];
  });

  protected readonly statusLabel = computed(() => {
    const record = this.item();
    return record === undefined ? '' : STOCK_STATUS_LABELS[stockStatus(record)];
  });

  protected readonly statusTone = computed(() => {
    const record = this.item();
    return record === undefined ? 'neutral' : stockStatusTone(stockStatus(record));
  });

  protected movementLabel(type: MovementType): string {
    return MOVEMENT_LABELS[type];
  }

  protected movementTone(type: MovementType): 'ready' | 'pending' | 'critical' | 'neutral' {
    switch (type) {
      case 'stock_in':
        return 'ready';
      case 'wastage':
        return 'critical';
      case 'stock_out':
        return 'neutral';
      default:
        return 'pending';
    }
  }

  protected batchExpiryText(batch: Batch): string {
    const days = daysUntil(batch.expiryDate);
    if (days < 0) {
      return `expired ${Math.abs(days)}d ago`;
    }
    return days === 0 ? 'expires today' : `${days}d left`;
  }

  protected batchExpiryClass(batch: Batch): string {
    const days = daysUntil(batch.expiryDate);
    if (days < 0) {
      return 'font-medium text-status-critical-strong';
    }
    return days <= 90 ? 'font-medium text-status-pending-strong' : 'text-surface-fg';
  }

  protected onMovementRecorded(message: string): void {
    this.dialogOpen.set(false);
    this.toast.success('Stock updated', message);
  }
}
