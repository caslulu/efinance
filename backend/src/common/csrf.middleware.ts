import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PATHS = [
  '/auth/google',
  '/auth/google/redirect',
];

function parseCookies(rawCookie: string | undefined): Record<string, string> {
  if (!rawCookie) return {};
  return rawCookie.split(';').reduce<Record<string, string>>((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function isSecure(): boolean {
  const forceHttps = process.env.FORCE_HTTPS;
  if (forceHttps !== undefined) return forceHttps === 'true';
  return (process.env.FRONTEND_URL || '').startsWith('https');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function issueCsrfToken(res: Response): string {
  const token = randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const cookies = parseCookies(req.headers.cookie);

    if (!cookies[CSRF_COOKIE]) {
      issueCsrfToken(res);
    }

    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const path = req.path || req.url || '';
    if (EXEMPT_PATHS.some((p) => path.startsWith(p))) {
      return next();
    }

    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken =
      (req.headers[CSRF_HEADER] as string | undefined) ||
      (req.headers['x-xsrf-token'] as string | undefined);

    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      this.logger.warn(
        `CSRF check failed: method=${req.method} path=${path} hasCookie=${!!cookieToken} hasHeader=${!!headerToken}`,
      );
      throw new ForbiddenException('CSRF token inválido ou ausente.');
    }

    return next();
  }
}
