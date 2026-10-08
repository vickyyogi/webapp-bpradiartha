/**
 * Privacy & Data Protection Utility (Section 30 - Privacy Principles)
 * Provides functions for masking personal and sensitive financial data for display or logging.
 */

/**
 * Masks NIK (Indonesian National ID Number - 16 digits)
 * Example: "3171012345678901" -> "3171**********01"
 */
export function maskNIK(nik?: string | null): string {
  if (!nik || nik.length < 8) return nik || "-";
  const start = nik.slice(0, 4);
  const end = nik.slice(-2);
  const maskedLength = Math.max(0, nik.length - 6);
  return `${start}${"*".repeat(maskedLength)}${end}`;
}

/**
 * Masks Phone Number
 * Example: "081234567890" -> "0812****7890"
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || phone.length < 7) return phone || "-";
  const start = phone.slice(0, 4);
  const end = phone.slice(-4);
  const maskedLength = Math.max(0, phone.length - 8);
  return `${start}${"*".repeat(maskedLength || 4)}${end}`;
}

/**
 * Masks Email Address
 * Example: "budi.santoso@bpradiartha.com" -> "b***o@bpradiartha.com"
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return email || "-";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}${"*".repeat(Math.min(5, local.length - 2))}${last}@${domain}`;
}

/**
 * Masks Bank Account Number
 * Example: "1234567890" -> "123****890"
 */
export function maskAccountNumber(acc?: string | null): string {
  if (!acc || acc.length < 6) return acc || "-";
  const start = acc.slice(0, 3);
  const end = acc.slice(-3);
  return `${start}${"*".repeat(acc.length - 6)}${end}`;
}

/**
 * Strips sensitive fields before writing data to public log files or client responses.
 */
export function sanitizeLogData<T extends Record<string, any>>(data: T): Partial<T> {
  const sanitized = { ...data };
  const sensitiveKeys = [
    "password",
    "passwordHash",
    "token",
    "secret",
    "pin",
    "cvv",
    "creditCardNumber",
  ];

  for (const key in sanitized) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      delete sanitized[key];
    } else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]) as any;
    }
  }

  return sanitized;
}
