import { getApiHost } from './api/get-api-host.util';

/**
 * Resolve an asset path returned by the backend into a URL the browser can load.
 * - If the value is already absolute (http/https) it's returned as-is.
 * - If it's root-relative (starts with '/') it's prefixed with the API host.
 * - Otherwise returned as-is.
 */
export function resolveAssetUrl(p?: string | null): string | undefined {
  if (!p) return undefined;
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) return `${getApiHost()}${p}`;
  return p;
}

export default resolveAssetUrl;
