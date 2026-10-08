import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const memoryStore: RateLimitStore = {};

// Clean up expired tokens periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const key in memoryStore) {
      if (memoryStore[key].resetTime < now) {
        delete memoryStore[key];
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  limit: number; // max allowed requests
  windowMs: number; // time window in milliseconds
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

/**
 * Checks if a request exceeds the rate limit.
 * Returns null if allowed, or a NextResponse 429 if rate limit exceeded.
 */
export function checkRateLimit(
  req: NextRequest,
  keyPrefix: string = "global",
  config: RateLimitConfig = { limit: 10, windowMs: 60 * 1000 }
): { isAllowed: boolean; response?: NextResponse; remaining: number; resetTime: number } {
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  const record = memoryStore[key];

  if (!record || record.resetTime < now) {
    // New window
    memoryStore[key] = {
      count: 1,
      resetTime: now + config.windowMs,
    };

    return {
      isAllowed: true,
      remaining: config.limit - 1,
      resetTime: now + config.windowMs,
    };
  }

  record.count += 1;

  if (record.count > config.limit) {
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
    const response = NextResponse.json(
      {
        error: "Terlalu banyak permintaan (Rate limit exceeded). Silakan coba beberapa saat lagi.",
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(record.resetTime / 1000)),
        },
      }
    );

    return {
      isAllowed: false,
      response,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  return {
    isAllowed: true,
    remaining: config.limit - record.count,
    resetTime: record.resetTime,
  };
}
