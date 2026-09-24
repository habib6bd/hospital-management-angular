import { Injectable, inject, signal, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly title: string;
  readonly message: string | null;
  /** 0 means the toast stays until dismissed. */
  readonly durationMs: number;
}

const DEFAULT_DURATIONS: Readonly<Record<ToastTone, number>> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 9000,
};

/**
 * Global, signal-backed toast queue. The error interceptor and feature services
 * push here; `ToastHostComponent` renders the signal.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly queue = signal<readonly Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 1;

  readonly toasts = this.queue.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
    });
  }

  success(title: string, message: string | null = null): number {
    return this.push('success', title, message);
  }

  error(title: string, message: string | null = null): number {
    return this.push('error', title, message);
  }

  warning(title: string, message: string | null = null): number {
    return this.push('warning', title, message);
  }

  info(title: string, message: string | null = null): number {
    return this.push('info', title, message);
  }

  push(tone: ToastTone, title: string, message: string | null = null, durationMs?: number): number {
    const id = this.nextId++;
    const toast: Toast = {
      id,
      tone,
      title,
      message,
      durationMs: durationMs ?? DEFAULT_DURATIONS[tone],
    };

    this.queue.update((current) => [...current, toast]);

    // No timers during SSR: they would keep the server render pending.
    if (this.isBrowser && toast.durationMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), toast.durationMs),
      );
    }
    return id;
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.set([]);
  }
}
