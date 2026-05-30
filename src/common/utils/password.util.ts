import * as bcrypt from 'bcrypt';

export async function hashSecret(value: string, rounds: number) {
  return bcrypt.hash(value, rounds);
}

export async function verifySecret(value: string, hash: string | null | undefined) {
  if (!hash) return false;
  return bcrypt.compare(value, hash);
}
