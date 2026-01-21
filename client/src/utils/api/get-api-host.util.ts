export const getApiHost = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  // Log para debuggear en producción
  console.log('[getApiHost] VITE_API_URL:', apiUrl);
  console.log('[getApiHost] hostname:', typeof window !== 'undefined' ? window.location.hostname : 'no window');
  
  // Si está configurada, usarla
  if (apiUrl && apiUrl.trim()) {
    console.log('[getApiHost] Usando VITE_API_URL:', apiUrl);
    return apiUrl;
  }
  
  // En producción (no localhost), usar el backend en Render por defecto
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.log('[getApiHost] Usando fallback Render para producción');
    return 'https://academyhub.onrender.com';
  }
  
  // En desarrollo, usar localhost
  console.log('[getApiHost] Usando fallback localhost para desarrollo');
  return 'http://localhost:3000';
};