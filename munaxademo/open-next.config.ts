import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext → Cloudflare Workers adapter config. Defaults are sufficient for this app:
 * the demo has no persistent server cache to externalise (data is generated in-browser),
 * and admin-created accounts persist via the KV binding wired in `wrangler.jsonc`.
 */
export default defineCloudflareConfig();
