import { preserveHostedBundles } from './hosted-bundles.mjs';

// This is required for every release, including simultaneous API deployments.
if (process.env.PRESERVE_HOSTED_BUNDLES !== 'false') {
  const { retained, total } = await preserveHostedBundles({
    base: process.env.PRODUCTION_URL || 'https://cotizapp-d71c8.web.app',
    output: process.env.HOSTED_BUNDLES_OUTPUT || 'dist/cotizacion-web/browser'
  });
  console.log(`Retained ${retained} bundles; ${total} versioned bundles available for open browser tabs.`);
}
