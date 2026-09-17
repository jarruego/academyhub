import { createContext, useContext } from "react";

// Acceso externo de un centro a su consultoría, por token opaco (no JWT) —
// ver docs/consultoria.md, "Guards y acceso externo". A diferencia de
// AUTH_CONTEXT (sesión normal, en localStorage), el token vive solo en la
// URL: no hay "sesión" que recordar entre visitas, cada enlace lleva el suyo.
export type ConsultingCentroContextInfo = {
    token: string;
};

export const CONSULTING_CENTRO_CONTEXT = createContext<ConsultingCentroContextInfo | null>(null);

export const useConsultingCentroInfo = () => {
    const ctx = useContext(CONSULTING_CENTRO_CONTEXT);
    if (!ctx) throw new Error("useConsultingCentroInfo debe usarse dentro de ConsultingCentroApp");
    return ctx;
};
