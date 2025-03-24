import { describe, expect, it } from 'vitest';
import { sum } from './sum';

describe('sum(a, b)', () => {
    it('should add two numbers', () => {
        const result = sum(1, 1);
        expect(result).toEqual(2);
    });
});

//npm install -D happy-dom