export const getApiHost = () => {
  const apiUrl = import.meta.env.VITE_API_URL;
  
  // En Vercel, si no está configurada, usar el backend en Render
  if (!apiUrl) {
    // Detectar si estamos en producción
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return 'https://academyhub.onrender.com';
    }
    return 'http://localhost:3000';
  }
  
  return apiUrl;
};