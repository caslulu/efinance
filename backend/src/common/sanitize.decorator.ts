import { Transform } from 'class-transformer';
import sanitizeHtml, { IOptions } from 'sanitize-html';

const STRICT_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

const RICH_OPTIONS: IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

export function sanitizeString(value: unknown, rich = false): unknown {
  if (typeof value !== 'string') return value;
  return sanitizeHtml(value, rich ? RICH_OPTIONS : STRICT_OPTIONS).trim();
}

export function Sanitize(rich = false): PropertyDecorator {
  return Transform(({ value }) => sanitizeString(value, rich));
}
