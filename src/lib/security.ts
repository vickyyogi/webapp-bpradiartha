import { NextResponse } from "next/server";

/**
 * Sanitizes input string to prevent basic XSS and injection attacks.
 */
export function sanitizeInput(str?: string | null): string {
  if (!str) return "";
  return str
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validates NIK format (16 numeric digits)
 */
export function isValidNIK(nik: string): boolean {
  return /^\d{16}$/.test(nik.trim());
}

/**
 * Validates Indonesian phone format (starts with 08 or +62, 9 to 15 digits)
 */
export function isValidPhone(phone: string): boolean {
  return /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(phone.trim().replace(/[-\s]/g, ""));
}

/**
 * Logs detailed internal error on server without leaking sensitive error messages to client.
 */
export function createSecureErrorResponse(
  error: any,
  contextMessage: string,
  statusCode: number = 500
): NextResponse {
  // Log detailed error on server console / monitoring
  console.error(`[SECURITY LOG] Error in ${contextMessage}:`, {
    message: error?.message || String(error),
    stack: error?.stack,
    timestamp: new Date().toISOString(),
  });

  // Return sanitized generic message to client
  const clientMessage =
    statusCode === 400
      ? error?.message || "Data yang dikirimkan tidak valid."
      : "Terjadi kesalahan internal pada server. Silakan hubungi administrator.";

  return NextResponse.json(
    {
      error: clientMessage,
      code: statusCode,
    },
    { status: statusCode }
  );
}
