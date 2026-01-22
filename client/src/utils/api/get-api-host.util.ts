/**
 * Retorna la URL base del backend.
 * En producción (no localhost), usa siempre Render.
 * En desarrollo local, usa la variable de entorno o localhost.
 */
export const getApiHost = (): string => {
  if (typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1') {
    // Producción: siempre usar Render
    return 'https://academyhub.onrender.com';
  }
  
  // Desarrollo: usar variable de entorno o fallback
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};