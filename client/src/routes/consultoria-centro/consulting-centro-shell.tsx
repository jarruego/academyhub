import { Layout, Result, Button, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { CONSULTING_CENTRO_CONTEXT } from "../../providers/consulting-centro/consulting-centro.context";
import { loadConsultingCentroToken, clearConsultingCentroToken } from "../../providers/consulting-centro/consulting-centro-session.util";

const { Content, Header } = Layout;

// Layout propio, sin sidebar ni login normal. El token ya no viene de la
// URL (solo la visita inicial al enlace lo lleva, ver
// consulting-centro-entry.route.tsx) sino de sessionStorage — si no está
// (navegador cerrado y reabierto, o "Salir"), no hay forma de recuperar el
// acceso más que volver a usar el enlace original. Ver docs/consultoria.md,
// "Guards y acceso externo".
export default function ConsultingCentroShell({ children }: { children: React.ReactNode }) {
  const token = loadConsultingCentroToken();

  if (!token) {
    return (
      <Result
        status="warning"
        title="Sesión no disponible"
        subTitle="Por seguridad, este acceso se pierde al cerrar el navegador — pide de nuevo tu enlace de acceso para entrar."
      />
    );
  }

  return (
    <CONSULTING_CENTRO_CONTEXT.Provider value={{ token }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            Consultoría — Acceso del centro
          </Typography.Title>
          <Button
            type="text"
            icon={<LogoutOutlined />}
            style={{ color: '#fff' }}
            onClick={() => { clearConsultingCentroToken(); window.location.href = '/'; }}
          >
            Salir
          </Button>
        </Header>
        <Content style={{ margin: 16 }}>{children}</Content>
      </Layout>
    </CONSULTING_CENTRO_CONTEXT.Provider>
  );
}
