// Description: Utility functions for the application

// Generate an easy to read random password with 5 letters, 1 symbol and 4 numbers
export const generateEasyPassword = () => {
  const chars = 'abcdefghjmnpqrstuvwxyzABCDEFGHJMNPQRSTUVWXYZ';
  const numbers = '123456789';
  const symbols = '@$_*';
  let password = '';
  for (let i = 0; i < 5; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  for (let i = 0; i < 4; i++) {
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  return password;
};
