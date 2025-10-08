import { Button, Card, List, Typography } from "antd";
import { ToolOutlined, DatabaseOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useReimportMoodleMutation } from "../../hooks/api/moodle/use-reimport-moodle.mutation";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const tools = [
  {
    key: "reimport-moodle",
    label: "Reimportar datos de Moodle",
    description: "Sincroniza manualmente los datos desde la plataforma Moodle.",
    icon: <ToolOutlined style={{ fontSize: 20 }} />,
    adminOnly: true,
    type: "action" as const,
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
  // Aquí se pueden añadir más herramientas en el futuro
];

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportMoodleMutation();
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
            if (tool.type === "action" && tool.key === "reimport-moodle") {
              return (
                <Button onClick={() => reimport()} loading={isReimporting} type="primary">
                  Reimportar
                </Button>
              );
            } else if (tool.type === "link") {
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
            <List.Item>
              <List.Item.Meta
                avatar={tool.icon}
                title={tool.label}
                description={tool.description}
              />
              {renderAction()}
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

export default ToolList;
