import * as crypto from 'crypto';

/**
 * Encrypted secret shape stored in DB: AES-256-GCM
 */
export type EncryptedSecret = { ct: string; iv: string; tag: string };

export function isEncryptedSecret(obj: unknown): obj is EncryptedSecret {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return typeof o.ct === 'string' && typeof o.iv === 'string' && typeof o.tag === 'string';
}

/**
 * Decrypt an EncryptedSecret using APP_MASTER_KEY (base64). Throws on error.
 */
export function decryptSecret(enc: unknown): string {
  const keyBase = process.env.APP_MASTER_KEY;
  if (!keyBase) throw new Error('APP_MASTER_KEY not set');
  const key = Buffer.from(keyBase, 'base64');

  if (!isEncryptedSecret(enc)) throw new Error('invalid ciphertext');

  const iv = Buffer.from(enc.iv, 'base64');
  const tag = Buffer.from(enc.tag, 'base64');
  const ct = Buffer.from(enc.ct, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Try to encrypt a plaintext secret using APP_MASTER_KEY (base64).
 * Returns the encrypted object or undefined if encryption not possible (missing key or invalid input).
 */
export function tryEncryptSecret(plain?: string): EncryptedSecret | undefined {
  if (!plain || typeof plain !== 'string') return undefined;
  const keyBase = process.env.APP_MASTER_KEY;
  if (!keyBase) return undefined;
  const key = Buffer.from(keyBase, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct: ct.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}
