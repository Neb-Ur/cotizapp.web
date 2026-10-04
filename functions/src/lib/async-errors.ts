/** Express 4 does not forward rejected async handlers to its error middleware. */
export function forwardAsyncErrors(router: any): void {
  for (const layer of router.stack || []) {
    if (layer.route) { forwardAsyncErrors(layer.route); continue; }
    if (layer.handle?.stack) { forwardAsyncErrors(layer.handle); continue; }
    const handler = layer.handle;
    if (typeof handler !== 'function' || handler.constructor.name !== 'AsyncFunction') continue;
    layer.handle = (req: any, res: any, next: any) => Promise.resolve(handler(req, res, next)).catch(next);
  }
}
