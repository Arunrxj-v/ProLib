/**
 * NOTE: no `server-only` import here — this module is pure Node crypto so the
 * dev seed script can reuse the exact same hashing implementation.
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(
  password: string,
  salt: Buffer,
  cost: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { ...cost, maxmem: COST.maxmem },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/**
 * scrypt password hashing. No external dependency, and no plaintext is ever
 * persisted. Stored format: `scrypt$N$r$p$salt$hash` (base64url components),
 * so the cost parameters can be raised later without invalidating old hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return [
    "scrypt",
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, "base64url");
  const actual = await derive(password, Buffer.from(saltB64, "base64url"), {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
