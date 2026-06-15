import {
  isEncryptedSecret,
  tryEncryptSecret,
  decryptSecret,
  encryptSecretToString,
  decryptSecretFromString,
} from './secrets.util';

// Clave AES-256 determinista (32 bytes) para los tests.
const TEST_KEY = Buffer.alloc(32, 1).toString('base64');

describe('secrets.util', () => {
  let prevKey: string | undefined;

  beforeAll(() => {
    prevKey = process.env.APP_MASTER_KEY;
    process.env.APP_MASTER_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.APP_MASTER_KEY;
    else process.env.APP_MASTER_KEY = prevKey;
  });

  describe('isEncryptedSecret', () => {
    it('reconoce la forma {ct,iv,tag}', () => {
      expect(isEncryptedSecret({ ct: 'a', iv: 'b', tag: 'c' })).toBe(true);
    });
    it('rechaza valores que no son secretos', () => {
      expect(isEncryptedSecret(null)).toBe(false);
      expect(isEncryptedSecret('texto')).toBe(false);
      expect(isEncryptedSecret({ ct: 'a' })).toBe(false);
      expect(isEncryptedSecret({ ct: 1, iv: 2, tag: 3 })).toBe(false);
    });
  });

  describe('tryEncryptSecret / decryptSecret (objeto)', () => {
    it('hace round-trip', () => {
      const enc = tryEncryptSecret('hunter2');
      expect(enc).toBeDefined();
      expect(isEncryptedSecret(enc)).toBe(true);
      expect(decryptSecret(enc)).toBe('hunter2');
    });

    it('el cifrado no contiene el texto plano', () => {
      const enc = tryEncryptSecret('miClaveSecreta');
      expect(JSON.stringify(enc)).not.toContain('miClaveSecreta');
    });

    it('dos cifrados del mismo texto difieren (IV aleatorio)', () => {
      const a = tryEncryptSecret('misma');
      const b = tryEncryptSecret('misma');
      expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    });

    it('devuelve undefined para entrada vacía', () => {
      expect(tryEncryptSecret('')).toBeUndefined();
      expect(tryEncryptSecret(undefined)).toBeUndefined();
    });
  });

  describe('encryptSecretToString / decryptSecretFromString (columna texto)', () => {
    it('hace round-trip a través de JSON', () => {
      const stored = encryptSecretToString('p@ssw0rd!');
      expect(typeof stored).toBe('string');
      expect(stored).not.toBe('p@ssw0rd!'); // está cifrado
      expect(decryptSecretFromString(stored)).toBe('p@ssw0rd!');
    });

    it('soporta API keys largas (>255 chars)', () => {
      const longSecret = 'SG.' + 'x'.repeat(300);
      const stored = encryptSecretToString(longSecret);
      expect(decryptSecretFromString(stored)).toBe(longSecret);
    });

    it('descifra texto plano legacy devolviéndolo tal cual', () => {
      expect(decryptSecretFromString('contraseña-en-claro')).toBe('contraseña-en-claro');
    });

    it('un JSON que no es un secreto se trata como texto plano', () => {
      expect(decryptSecretFromString('{"foo":"bar"}')).toBe('{"foo":"bar"}');
    });

    it('preserva null / undefined / cadena vacía', () => {
      expect(encryptSecretToString(null)).toBeNull();
      expect(encryptSecretToString(undefined)).toBeUndefined();
      expect(encryptSecretToString('')).toBe('');
      expect(decryptSecretFromString(null)).toBeNull();
      expect(decryptSecretFromString(undefined)).toBeUndefined();
      expect(decryptSecretFromString('')).toBe('');
    });

    it('ante un blob cifrado corrupto NO lanza, devuelve lo almacenado (degradación segura)', () => {
      const stored = encryptSecretToString('algo') as string;
      const parsed = JSON.parse(stored);
      parsed.ct = Buffer.from('basura').toString('base64'); // corromper el ciphertext
      const corrupted = JSON.stringify(parsed);
      expect(() => decryptSecretFromString(corrupted)).not.toThrow();
      expect(decryptSecretFromString(corrupted)).toBe(corrupted);
    });
  });

  describe('sin APP_MASTER_KEY (degradación segura)', () => {
    let saved: string | undefined;
    beforeAll(() => {
      saved = process.env.APP_MASTER_KEY;
      delete process.env.APP_MASTER_KEY;
    });
    afterAll(() => {
      process.env.APP_MASTER_KEY = saved;
    });

    it('encryptSecretToString devuelve el texto plano (no rompe el flujo)', () => {
      expect(encryptSecretToString('claro')).toBe('claro');
    });

    it('decryptSecretFromString de texto plano lo devuelve igual', () => {
      expect(decryptSecretFromString('claro')).toBe('claro');
    });
  });
});
