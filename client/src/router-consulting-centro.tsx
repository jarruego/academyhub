import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ConsultingCentroEntryRoute from './routes/consultoria-centro/consulting-centro-entry.route';
import ConsultingCentroShell from './routes/consultoria-centro/consulting-centro-shell';
import ConsultingCentroEngagementsRoute from './routes/consultoria-centro/consulting-centro-engagements.route';
import ConsultingCentroEngagementRoute from './routes/consultoria-centro/consulting-centro-engagement.route';
import ConsultingCentroNoAccess from './routes/consultoria-centro/consulting-centro-no-access';

// Router propio para el acceso externo del centro, sin sidebar ni login
// normal — montado en main.tsx en vez del router autenticado de siempre.
// El token solo aparece en la URL de entrada (/consultoria-centro/:token);
// el resto de rutas ("/app...") lo leen de sessionStorage, no de la URL —
// ver consulting-centro-entry.route.tsx y docs/consultoria.md.
export default function ConsultingCentroRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/consultoria-centro/:token" element={<ConsultingCentroEntryRoute />} />
        <Route path="/consultoria-centro/app" element={<ConsultingCentroShell><ConsultingCentroEngagementsRoute /></ConsultingCentroShell>} />
        <Route path="/consultoria-centro/app/:id_annual_engagement" element={<ConsultingCentroShell><ConsultingCentroEngagementRoute /></ConsultingCentroShell>} />
        <Route path="*" element={<ConsultingCentroNoAccess />} />
      </Routes>
    </Router>
  );
}
