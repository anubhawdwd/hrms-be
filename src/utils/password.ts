import crypto from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // excludes I, O
const LOWER = "abcdefghjkmnpqrstuvwxyz"; // excludes l, o
const DIGITS = "23456789";               // excludes 0, 1
const SYMBOLS = "!@#$%&*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/**
 * Generates a cryptographically secure, human-readable temporary password.
 * Length: 12 characters.
 * Guarantees a mix of uppercase, lowercase, numbers, and special symbols
 * while avoiding easily confused characters (0/O, 1/l/I).
 */
export function generateTemporaryPassword(): string {
  const chars: string[] = [];

  // Guarantee minimum character variety
  for (let i = 0; i < 2; i++) {
    chars.push(UPPER.charAt(crypto.randomInt(0, UPPER.length)));
    chars.push(LOWER.charAt(crypto.randomInt(0, LOWER.length)));
    chars.push(DIGITS.charAt(crypto.randomInt(0, DIGITS.length)));
    chars.push(SYMBOLS.charAt(crypto.randomInt(0, SYMBOLS.length)));
  }

  // Fill remaining characters up to 12
  while (chars.length < 12) {
    chars.push(ALL.charAt(crypto.randomInt(0, ALL.length)));
  }

  // Fisher-Yates shuffle with cryptographic randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = temp;
  }

  return chars.join("");
}
