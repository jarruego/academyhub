import { Button, Layout, Result } from "antd";

const { Content, Header } = Layout;

interface Props {
  /** false cuando ya se muestra dentro de ConsultingCentroShell (que ya pone su propia cabecera) — evita duplicarla. Por defecto true (uso independiente). */
  standalone?: boolean;
}

// Pantalla única para CUALQUIER caso en que un token de centro no tenga
// acceso a algo — ruta que no existe dentro de su mini-app, una
// consultoría que no es la suya, el token revocado/inválido, o una URL de
// la app normal fuera de /consultoria-centro/*. Mismo mensaje siempre
// ("Sesión no disponible"), a propósito (2026-09-17, pedido explícito del
// usuario): no distinguir motivos con textos distintos, un solo aviso
// consistente — y nunca, bajo ningún caso, la pantalla de login normal,
// que no tiene sentido para quien entra por enlace, no por
// usuario/contraseña. `<a>` normal, no `<Link>` de react-router: este
// componente se usa también fuera de cualquier Router (ver main.tsx). Ver
// docs/consultoria.md, "Guards y acceso externo".
export default function ConsultingCentroNoAccess({ standalone = true }: Props) {
  const result = (
    <Result
      status="warning"
      title="Sesión no disponible"
      subTitle="Por seguridad, este acceso se pierde al cerrar el navegador — pide de nuevo tu enlace de acceso para entrar."
      extra={<Button type="primary" href="/consultoria-centro/app">Volver a mi portada</Button>}
    />
  );

  if (!standalone) return result;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>Consultoría — Acceso del centro</span>
      </Header>
      <Content style={{ margin: 16 }}>{result}</Content>
    </Layout>
  );
}
