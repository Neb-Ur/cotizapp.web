import { Injectable, inject, signal } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
@Injectable({providedIn: 'root'})
export class WriteFeedbackService {
  readonly pending = signal(0);
  private readonly active = new Set<string>();
  async run(key: string, work: () => Promise<void>): Promise<void> {
    if (this.active.has(key)) return;
    this.active.add(key); this.pending.update(count => count + 1);
    try { await work(); }
    finally { this.active.delete(key); this.pending.update(count => count - 1); }
  }
}
export const writeFeedbackInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url.includes('/metricas/') || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) return next(request);
  const feedback = inject(WriteFeedbackService);
  feedback.pending.update(count => count + 1);
  return next(request).pipe(finalize(() => feedback.pending.update(count => count - 1)));
};
