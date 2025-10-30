import { lazy } from 'react';

const ImportVelneoScreen = lazy(() => import('../../components/tools/ImportVelneoScreen'));

export default {
  path: '/tools/import-velneo',
  element: <ImportVelneoScreen />,
  label: 'Importar Velneo',
  showInMenu: true,
};
