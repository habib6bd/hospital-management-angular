import { Injectable, computed, signal } from '@angular/core';

/**
 * Global in-flight request counter. Replaces the per-component `isLoading`
 * boolean: the loading interceptor increments/decrements, the shell renders
 * the derived signal.
 *
 * Per-resource loading (skeletons inside a list) still comes from the
 * `httpResource`'s own `isLoading()` — this one drives only the top progress bar.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly inFlight = signal(0);

  readonly pendingCount = this.inFlight.asReadonly();
  readonly isLoading = computed(() => this.inFlight() > 0);

  start(): void {
    this.inFlight.update((count) => count + 1);
  }

  stop(): void {
    this.inFlight.update((count) => Math.max(0, count - 1));
  }

  reset(): void {
    this.inFlight.set(0);
  }
}
