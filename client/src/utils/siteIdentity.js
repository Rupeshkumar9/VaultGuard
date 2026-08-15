import { parse } from 'tldts';

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export function parseSiteIdentity(value) {
  if (!value || typeof value !== 'string') return null;

  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!SUPPORTED_PROTOCOLS.has(url.protocol)) return null;

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const parsed = parse(hostname, { allowPrivateDomains: true });

    return {
      protocol: url.protocol,
      hostname,
      port: url.port,
      origin: `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ''}`,
      registrableDomain: parsed.domain || null,
      publicSuffix: parsed.publicSuffix || null,
      isIp: !!parsed.isIp,
    };
  } catch {
    return null;
  }
}

export function sitesMatch(storedValue, pageValue, { allowRelatedSubdomains = true } = {}) {
  const stored = parseSiteIdentity(storedValue);
  const page = parseSiteIdentity(pageValue);
  if (!stored || !page) return false;

  // Never offer a credential across an HTTP/HTTPS boundary or a different port.
  if (stored.protocol !== page.protocol || stored.port !== page.port) return false;
  if (stored.hostname === page.hostname) return true;
  if (!allowRelatedSubdomains || stored.isIp || page.isIp) return false;

  return !!stored.registrableDomain &&
    stored.registrableDomain === page.registrableDomain;
}

export function getSiteHostname(value) {
  return parseSiteIdentity(value)?.hostname || '';
}
