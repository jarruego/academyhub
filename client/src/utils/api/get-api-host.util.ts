export const getApiHost = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  // Si la URL no termina en /api, agrégalo
  if (!baseUrl.endsWith('/api')) {
    return `${baseUrl}/api`;
  }
  return baseUrl;
};