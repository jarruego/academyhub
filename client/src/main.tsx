import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Router from './router';
import ConsultingCentroRouter from './router-consulting-centro';
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

  return (
    <ConfigProvider theme={buildTheme(mode, density)}>
      <AntdApp>
        {isConsultingCentroRoute ? (
          <ConsultingCentroRouter />
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
