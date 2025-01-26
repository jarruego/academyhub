import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Router from './router';
import AuthProvider from './providers/auth/auth.provider';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            // Seed Token
            colorPrimary: '#00b96b',
          },
        }}
      >
        <AuthProvider>
          <Router/>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  </StrictMode>,
)
