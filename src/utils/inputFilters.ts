// Typing filters: a field only accepts the data it expects (same rules as the
// server TypedInputGuard, which stays the authority).

/** Phone number: digits only, with one optional leading "+". */
export function sanitizePhoneInput(value: string): string {
  const plus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}

/** Digits only (OTP, card number, routing number). */
export function sanitizeDigitsInput(value: string): string {
  return value.replace(/\D/g, '');
}
