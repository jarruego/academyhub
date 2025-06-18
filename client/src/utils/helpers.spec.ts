import { describe, it, expect } from 'vitest';
import { generateEasyPassword } from './helpers';

describe('generateEasyPassword', () => {
  it('debería generar una contraseña de 10 caracteres', () => {
    const password = generateEasyPassword();
    expect(password).toHaveLength(10);
  });

  it('debería contener exactamente 5 letras, 1 símbolo y 4 números', () => {
    const password = generateEasyPassword();
    const letters = password.slice(0, 5);
    const symbol = password[5];
    const numbers = password.slice(6);
    expect(letters).toMatch(/^[a-zA-Z]{5}$/);
    expect(symbol).toMatch(/[@$_*]/);
    expect(numbers).toMatch(/^[0-9]{4}$/);
  });

  it('debería generar contraseñas aleatorias', () => {
    const passwords = new Set(Array.from({ length: 20 }, generateEasyPassword));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
