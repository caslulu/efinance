import type { WishlistScrapeResponse, WishlistScrapeResponseRaw } from '@/types/Wishlist';

export function parseWishlistPrice(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = value.trim().replace(/[^\d,.-]/g, '');
  if (!sanitized) {
    return null;
  }

  const lastComma = sanitized.lastIndexOf(',');
  const lastDot = sanitized.lastIndexOf('.');
  const decimalSeparator = detectDecimalSeparator(sanitized, lastComma, lastDot);

  const normalized = decimalSeparator
    ? sanitized
        .replace(new RegExp(`\\${decimalSeparator}(?=.*\\${decimalSeparator})`, 'g'), '')
        .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
        .replace(decimalSeparator, '.')
    : sanitized.replace(/[,.]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isSupportedWishlistProductUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      /(^|\.)amazon\.com\.br$/i.test(hostname) ||
      /(^|\.)mercadolivre\.com\.br$/i.test(hostname) ||
      /(^|\.)mercadolibre\./i.test(hostname)
    );
  } catch {
    return false;
  }
}

export function normalizeWishlistScrapeResponse(
  payload: WishlistScrapeResponseRaw | null | undefined,
  url?: string,
): WishlistScrapeResponse {
  const rawName =
    payload?.name ??
    payload?.title ??
    payload?.productName ??
    payload?.name_product ??
    null;
  const normalizedName = normalizeWishlistName(rawName) ?? inferWishlistNameFromUrl(url);

  return {
    name: normalizedName,
    price: parseWishlistPrice(
      payload?.price ??
        payload?.salePrice ??
        payload?.currentPrice ??
        payload?.amount ??
        null,
    ),
    image: payload?.image ?? payload?.imageUrl ?? payload?.thumbnail ?? null,
  };
}

function normalizeWishlistName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 2 ? normalized : null;
}

function detectDecimalSeparator(
  value: string,
  lastComma: number,
  lastDot: number,
): ',' | '.' | null {
  if (lastComma === -1 && lastDot === -1) {
    return null;
  }

  if (lastComma !== -1 && lastDot !== -1) {
    return lastComma > lastDot ? ',' : '.';
  }

  const separator = lastComma !== -1 ? ',' : '.';
  const index = separator === ',' ? lastComma : lastDot;
  const digitsAfterSeparator = value.length - index - 1;

  if (digitsAfterSeparator === 2 || digitsAfterSeparator === 1) {
    return separator;
  }

  return null;
}

function inferWishlistNameFromUrl(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const { pathname, hostname } = new URL(url);
    const segments = pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);

    const amazonDpIndex = segments.findIndex((segment) => /^dp$/i.test(segment));
    const rawSegment =
      amazonDpIndex > 0
        ? segments[amazonDpIndex - 1]
        : [...segments]
            .reverse()
            .find(
              (segment) =>
                segment.length > 4 &&
                !/^([A-Z]{2,}\d+|\d+|p)$/i.test(segment),
            );

    if (!rawSegment) {
      return hostname.replace(/^www\./i, '');
    }

    const cleaned = rawSegment
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned.length > 2 ? cleaned : null;
  } catch {
    return null;
  }
}
