import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { fail } from './http.js';

interface Bucket {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  name: string;
}

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

function clientKey(req: Request, name: string): string {
  const forwarded = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || req.ip || req.socket.remoteAddress || 'unknown';
  return `${name}:${createHash('sha256').update(address).digest('hex')}`;
}

function cleanup(now: number): void {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanup(now);
    const key = clientKey(req, options.name);
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('RateLimit-Limit', String(options.max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      fail(res, 'RATE_LIMIT_EXCEEDED', 'Demasiadas solicitudes. Intenta nuevamente más tarde.', 429);
      return;
    }
    next();
  };
}

export const generalRateLimit = rateLimit({ name: 'general', windowMs: 60_000, max: 180 });
export const sensitiveWriteRateLimit = rateLimit({ name: 'sensitive-write', windowMs: 15 * 60_000, max: 10 });
export const statusLookupRateLimit = rateLimit({ name: 'status-lookup', windowMs: 15 * 60_000, max: 30 });
