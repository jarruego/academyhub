import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Router from './router';
import ConsultingCentroRouter from './router-consulting-centro';
import ConsultingCentroNoAccess from './routes/consultoria-centro/consulting-centro-no-access';
import { loadConsultingCentroToken } from './providers/consulting-centro/consulting-centro-session.util';
import AuthProvider from './providers/auth/auth.provider';
import { App as AntdApp } from "antd";
import { buildTheme } from './theme/tokens';
import { UiPreferencesProvider, useUiPreferences } from './theme/ui-preferences';
import './index.css';

const queryClient = new QueryClient();

/**
 * Aplica las preferencias de UI al tema. Va en un componente propio porque
 * `useUiPreferences()` tiene que colgar del provider, y el `ConfigProvider` que
 * consume el tema tiene que colgar de este.
 */
function ThemedApp() {
  const { mode, density } = useUiPreferences();
  // Acceso externo del centro (token en la URL, sin login normal) — se
  // decide antes de montar AuthProvider, que bloquea todo lo demás detrás
  // de la pantalla de login independientemente de la ruta. Ver
  // docs/consultoria.md, "Guards y acceso externo".
  const isConsultingCentroRoute = window.location.pathname.startsWith('/consultoria-centro/');
  // Un centro que solo tiene el token (sin login normal) y acaba en una URL
  // fuera de su mini-app (historial del navegador, enlace viejo, escrito a
  // mano...) no debe ver la pantalla de login — no tiene usuario/contraseña,
  // no tiene sentido para él. Si ya hay una sesión de centro en curso y no
  // hay una sesión normal real, se le manda a una pantalla informativa en
  // vez de montar AuthProvider (que mostraría el login). Un login real
  // manda siempre por delante — nunca se le tapa la app normal a un
  // usuario de verdad por un token de centro que quedara suelto.
  const hasNormalLogin = !!localStorage.getItem('userInfo');
  const hasStrandedCentroSession = !isConsultingCentroRoute && !hasNormalLogin && !!loadConsultingCentroToken();

  return (
    <ConfigProvider theme={buildTheme(mode, density)}>
      <AntdApp>
        {isConsultingCentroRoute ? (
          <ConsultingCentroRouter />
        ) : hasStrandedCentroSession ? (
          <ConsultingCentroNoAccess />
        ) : (
          <AuthProvider>
            <Router />
          </AuthProvider>
        )}
      </AntdApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <ThemedApp />
      </UiPreferencesProvider>
    </QueryClientProvider>
  </StrictMode>,
)
