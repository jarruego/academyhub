import { randomInt } from 'crypto';

// Generate an easy-to-read alphanumeric password that excludes confusing characters
// Requirements: default length 8, include uppercase, lowercase and digits, exclude l,i,o,ñ and 0
export function generatePassword(length = 8): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz'; // excludes i, l, o, ñ
  const upper = lower.toUpperCase();
  const digits = '123456789'; // excludes 0
  const all = lower + upper + digits;

  const pick = (chars: string) => chars[randomInt(chars.length)];

  // Ensure at least one lower, one upper, one digit
  let pwd = '';
  pwd += pick(lower);
  pwd += pick(upper);
  pwd += pick(digits);

  for (let i = pwd.length; i < length; i++) {
    pwd += pick(all);
  }

  // Shuffle
  const arr = pwd.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}
