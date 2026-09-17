// Guarda el token del acceso externo del centro solo para la pestaña/ventana
// actual — sessionStorage se borra al cerrar el navegador (a propósito, ver
// docs/consultoria.md: "Guards y acceso externo"). Nunca localStorage: eso
// sobreviviría a cerrar el navegador, justo lo que no se quiere aquí.
const STORAGE_KEY = "consultoria_centro_token";

export const saveConsultingCentroToken = (token: string) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Almacenamiento no disponible (privado/bloqueado) — sin sesión persistente,
    // cada navegación de vuelta al enlace original vuelve a guardarlo.
  }
};

export const loadConsultingCentroToken = (): string | null => {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export const clearConsultingCentroToken = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
};
