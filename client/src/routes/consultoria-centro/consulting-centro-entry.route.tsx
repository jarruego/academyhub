import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { saveConsultingCentroToken } from "../../providers/consulting-centro/consulting-centro-session.util";

// Único sitio donde el token vive en la URL — la visita al enlace que se
// comparte con el centro. Lo guarda en sessionStorage (se pierde al cerrar
// el navegador, a propósito) y redirige a las rutas internas de la app, que
// ya no lo llevan en la URL — así no queda expuesto en el historial ni en
// el autocompletado más allá de esta primera visita. Ver docs/consultoria.md.
export default function ConsultingCentroEntryRoute() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) saveConsultingCentroToken(token);
    navigate("/consultoria-centro/app", { replace: true });
  }, [token, navigate]);

  return null;
}
