import { Card, Typography, Space } from "antd";
import { DatabaseOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

const DataCrossReference = () => {
  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <DatabaseOutlined style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }} />
            <Title level={2}>Cruce de Datos BD - Moodle</Title>
            <Paragraph type="secondary">
              Herramienta para cruzar y comparar datos de usuarios entre la base de datos local y la plataforma Moodle.
            </Paragraph>
          </div>
          
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <Paragraph>
              Esta herramienta está en desarrollo. Aquí se implementará la funcionalidad para:
            </Paragraph>
            <ul style={{ textAlign: "left", display: "inline-block" }}>
              <li>Comparar usuarios entre BD local y Moodle</li>
              <li>Identificar discrepancias en los datos</li>
              <li>Sincronizar información faltante</li>
              <li>Generar reportes de diferencias</li>
            </ul>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default DataCrossReference;