import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// SMELL: should use bcrypt/argon2, not SHA-256 for passwords
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const candidate = createHash('sha256').update(password + salt).digest('hex');
  // At least uses timing-safe comparison
  return timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}
