import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import sanitizeHtml, { IOptions } from 'sanitize-html';

const STRICT: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

const RAW_FIELDS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'registerToken',
  'access_token',
  'csrfToken',
  'url',
  'avatarUrl',
  'callbackUrl',
  'content',
  'message',
]);

function sanitizeValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && RAW_FIELDS.has(key)) return value;
    return sanitizeHtml(value, STRICT);
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v, key));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeValue(v, k);
    }
    return out;
  }
  return value;
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req?.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }
    if (req?.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }
    return next.handle();
  }
}
