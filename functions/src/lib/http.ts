import type { Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ ok: true, data });
}

export function fail(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: unknown
): Response {
  return res.status(status).json({
    ok: false,
    error: { code, message, details }
  });
}
