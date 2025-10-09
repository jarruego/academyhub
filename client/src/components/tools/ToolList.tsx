import { Button, Card, List, Typography } from "antd";
import { ToolOutlined, DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const tools = [
  {
    key: "moodle-import",
    label: "Importación de Moodle",
    description: "Gestiona la importación de cursos, grupos y usuarios desde Moodle.",
    icon: <ToolOutlined style={{ fontSize: 20 }} />,
    adminOnly: true,
    type: "link" as const,
    linkTo: "/tools/moodle-import",
  },
  {
    key: "data-cross-reference",
    label: "Cruce de datos BD - Moodle",
    description: "Compara y cruza datos de usuarios entre la base de datos local y Moodle.",
    icon: <DatabaseOutlined style={{ fontSize: 20 }} />,
    adminOnly: true,
    type: "link" as const,
    linkTo: "/tools/data-cross-reference",
  },
  {
    key: "sage-import",
    label: "Importación CSV SAGE",
    description: "Importa datos desde archivos CSV generados por SAGE.",
    icon: <FileTextOutlined style={{ fontSize: 20 }} />,
    adminOnly: true,
    type: "link" as const,
    linkTo: "/tools/sage-import",
  },
  // Aquí se pueden añadir más herramientas en el futuro
];

const ToolList = () => {
  return (
    <Card title={<span>Herramientas administrativas</span>} bordered style={{ maxWidth: 500, margin: "0 auto" }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Accede a utilidades administrativas. Pronto habrá más herramientas disponibles.
      </Typography.Paragraph>
      <List
        itemLayout="horizontal"
        dataSource={tools}
        renderItem={tool => {
          const renderAction = () => {
            if (tool.type === "link") {
              return (
                <Link to={tool.linkTo}>
                  <Button type="primary">
                    Abrir herramienta
                  </Button>
                </Link>
              );
            }
            return null;
          };

          return tool.adminOnly ? (
            <AuthzHide roles={[Role.ADMIN]}>
              <List.Item>
                <List.Item.Meta
                  avatar={tool.icon}
                  title={tool.label}
                  description={tool.description}
                />
                {renderAction()}
              </List.Item>
            </AuthzHide>
          ) : (
            <AuthzHide roles={[Role.ADMIN]}>
              <List.Item>
                <List.Item.Meta
                  avatar={tool.icon}
                  title={tool.label}
                  description={tool.description}
                />
                {renderAction()}
              </List.Item>
            </AuthzHide>
          );
        }}
      />
    </Card>
  );
};

export default ToolList;
