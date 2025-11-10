import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiter (for production, use Redis or similar)
const rateLimit = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration per endpoint pattern
const RATE_LIMITS = {
  '/api/chat': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  '/api/search': { maxRequests: 10, windowMs: 60000 },
  '/api/images': { maxRequests: 5, windowMs: 60000 },
  '/api/videos': { maxRequests: 5, windowMs: 60000 },
  '/api/uploads': { maxRequests: 3, windowMs: 60000 }, // 3 uploads per minute
  '/api/config': { maxRequests: 10, windowMs: 60000 },
  '/api/providers': { maxRequests: 10, windowMs: 60000 },
  default: { maxRequests: 20, windowMs: 60000 }, // Default: 20 req/min
};

function getRateLimitKey(ip: string, pathname: string): string {
  return `${ip}:${pathname}`;
}

function getRateLimitConfig(pathname: string) {
  // Match the most specific route
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== 'default' && pathname.startsWith(pattern)) {
      return config;
    }
  }
  return RATE_LIMITS.default;
}

function checkRateLimit(
  ip: string,
  pathname: string,
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const key = getRateLimitKey(ip, pathname);
  const config = getRateLimitConfig(pathname);
  const now = Date.now();

  const record = rateLimit.get(key);

  if (!record || now > record.resetTime) {
    // Create new window
    const resetTime = now + config.windowMs;
    rateLimit.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime };
  }

  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment count
  record.count++;
  rateLimit.set(key, record);
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of rateLimit.entries()) {
      if (now > record.resetTime) {
        rateLimit.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Apply rate limiting only to API routes
  if (pathname.startsWith('/api/')) {
    // Get client IP (handling various proxy headers)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const { allowed, remaining, resetTime } = checkRateLimit(ip, pathname);

    if (!allowed) {
      const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
          },
        },
      );
    }

    // Add rate limit headers to response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set(
      'X-RateLimit-Reset',
      new Date(resetTime).toISOString(),
    );
    return response;
  }

  return NextResponse.next();
}

// Configure which routes to apply middleware to
export const config = {
  matcher: '/api/:path*',
};
