import { vi } from 'vitest';
import { WriteFeedbackService } from './write-feedback.service';
it('shows pending work immediately, prevents duplicate saves and clears after completion', async () => {
  const service = new WriteFeedbackService();
  let finish!: () => void;
  const work = vi.fn(() => new Promise<void>(resolve => finish = resolve));
  const pending = service.run('save-product', work);
  expect(service.pending()).toBe(1);
  await service.run('save-product', work);
  expect(work).toHaveBeenCalledOnce();
  finish(); await pending;
  expect(service.pending()).toBe(0);
});
it('always clears feedback on failure and permits retry', async () => {
  const service = new WriteFeedbackService();
  await expect(service.run('save', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  expect(service.pending()).toBe(0);
  const retry = vi.fn(async () => undefined);
  await service.run('save', retry); expect(retry).toHaveBeenCalledOnce();
});
